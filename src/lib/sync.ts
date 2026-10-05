import "server-only";
import { getPool, sql } from "./db";
import { decryptToken } from "./crypto";
import { fetchPricing, fetchWabaCurrency } from "./meta";

type ClientRow = { id: number; waba_id: string; access_token_enc: string; currency: string };
type Agg = { day: string; phone: string; country: string; cat: string; type: string; volume: number; cost: number };

/** Sincroniza los últimos `days` días de un cliente (upsert idempotente). */
export async function syncClient(clientId: number, days = 7) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("id", sql.Int, clientId)
    .query<ClientRow>("SELECT id, waba_id, access_token_enc, currency FROM clients WHERE id=@id");
  const c = recordset[0];
  if (!c?.waba_id || !c.access_token_enc) throw new Error("El cliente no tiene WABA ID o token configurado.");

  try {
    const token = decryptToken(c.access_token_enc);
    const currency = (await fetchWabaCurrency(c.waba_id, token)) ?? c.currency;
    const now = Math.floor(Date.now() / 1000);
    const toSec = Math.floor(now / 86400) * 86400 + 86400;
    const fromSec = Math.floor((now - days * 86400) / 86400) * 86400;
    const points = await fetchPricing(c.waba_id, token, fromSec, toSec);

    // Agrega por clave para evitar duplicados dentro del mismo lote.
    const rows = new Map<string, Agg>();
    for (const p of points) {
      const day = new Date(p.start * 1000).toISOString().slice(0, 10);
      const phone = p.phone_number ?? "";
      const country = p.country ?? "";
      const cat = p.pricing_category ?? "";
      const type = p.pricing_type ?? "";
      const k = [day, phone, country, cat, type].join("|");
      const cur = rows.get(k) ?? { day, phone, country, cat, type, volume: 0, cost: 0 };
      cur.volume += p.volume ?? 0;
      cur.cost += p.cost ?? 0;
      rows.set(k, cur);
    }

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const r of rows.values()) {
        await new sql.Request(tx)
          .input("cid", sql.Int, c.id)
          .input("day", sql.Date, r.day)
          .input("phone", sql.NVarChar(30), r.phone)
          .input("country", sql.NVarChar(10), r.country)
          .input("cat", sql.NVarChar(30), r.cat)
          .input("type", sql.NVarChar(30), r.type)
          .input("volume", sql.Int, r.volume)
          .input("cost", sql.Decimal(18, 6), r.cost)
          .input("cur", sql.NVarChar(10), currency).query(`
            MERGE message_costs WITH (HOLDLOCK) AS t
            USING (SELECT @cid cid, @day d, @phone p, @country co, @cat ca, @type ty) AS s
              ON t.client_id=s.cid AND t.day=s.d AND t.phone_number=s.p AND t.country=s.co
             AND t.pricing_category=s.ca AND t.pricing_type=s.ty
            WHEN MATCHED THEN UPDATE SET volume=@volume, cost=@cost, currency=@cur
            WHEN NOT MATCHED THEN INSERT (client_id, day, phone_number, country, pricing_category, pricing_type, volume, cost, currency)
              VALUES (@cid, @day, @phone, @country, @cat, @type, @volume, @cost, @cur);`);
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    await pool
      .request()
      .input("id", sql.Int, c.id)
      .input("cur", sql.NVarChar(10), currency)
      .query("UPDATE clients SET last_synced_at=SYSUTCDATETIME(), last_sync_error=NULL, currency=@cur WHERE id=@id");
    return rows.size;
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await pool
      .request()
      .input("id", sql.Int, c.id)
      .input("err", sql.NVarChar(500), msg)
      .query("UPDATE clients SET last_sync_error=@err WHERE id=@id");
    throw e;
  }
}

export async function syncAllClients(days = 7) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .query<{ id: number }>("SELECT id FROM clients WHERE active=1 AND waba_id IS NOT NULL AND access_token_enc IS NOT NULL");
  const results: { id: number; rows?: number; error?: string }[] = [];
  for (const { id } of recordset) {
    try {
      results.push({ id, rows: await syncClient(id, days) });
    } catch (e) {
      results.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

const AUTO_SYNC_MINUTES = 30;

/**
 * Sincroniza en segundo plano si los datos del cliente tienen más de 30 minutos.
 * El UPDATE atómico "reclama" el turno, así que visitas simultáneas lanzan una sola sincronización.
 * Nunca lanza: un fallo aquí no debe romper la página.
 */
export async function maybeAutoSync(clientId: number) {
  try {
    const pool = await getPool();
    const { recordset } = await pool
      .request()
      .input("id", sql.Int, clientId)
      .input("min", sql.Int, AUTO_SYNC_MINUTES)
      .query<{ id: number }>(`
        UPDATE clients SET last_sync_attempt_at = SYSUTCDATETIME()
        OUTPUT inserted.id
        WHERE id=@id AND active=1 AND waba_id IS NOT NULL AND access_token_enc IS NOT NULL
          AND (last_synced_at IS NULL OR last_synced_at < DATEADD(minute, -@min, SYSUTCDATETIME()))
          AND (last_sync_attempt_at IS NULL OR last_sync_attempt_at < DATEADD(minute, -@min, SYSUTCDATETIME()))`);
    if (recordset.length) await syncClient(clientId, 7);
  } catch (e) {
    console.error("auto-sync falló", e);
  }
}
