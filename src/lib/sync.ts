import "server-only";
import { getPool, sql } from "./db";
import { decryptToken } from "./crypto";
import { fetchInvoices, fetchOwnerBusinessId, fetchPricing, fetchWabaCurrency } from "./meta";

type ClientRow = {
  id: number;
  waba_id: string;
  access_token_enc: string;
  currency: string;
  business_id: string | null;
};

/** "2025-10-01T00:00:00+0000" -> Date (el sufijo sin ':' no siempre se parsea). */
function parseMetaDate(v?: string) {
  if (!v) return null;
  const d = new Date(v.replace(/([+-]\d\d)(\d\d)$/, "$1:$2"));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Guarda las facturas de Meta del cliente. Nunca lanza: devuelve el error para mostrarlo en el panel. */
export async function syncInvoices(c: ClientRow, token: string) {
  const pool = await getPool();
  try {
    let businessId = c.business_id;
    if (!businessId) {
      businessId = await fetchOwnerBusinessId(c.waba_id, token);
      if (!businessId) {
        throw new Error("No se pudo detectar el Business ID. Cargalo a mano en la configuración del cliente.");
      }
      await pool
        .request()
        .input("id", sql.Int, c.id)
        .input("b", sql.NVarChar(50), businessId)
        .query("UPDATE clients SET business_id=@b WHERE id=@id AND business_id IS NULL");
    }

    const invoices = await fetchInvoices(businessId, token);
    for (const i of invoices) {
      const amount = i.amount !== undefined && i.amount !== "" ? Number(i.amount) : null;
      await pool
        .request()
        .input("cid", sql.Int, c.id)
        .input("meta", sql.NVarChar(50), i.id)
        .input("inv", sql.NVarChar(50), i.invoice_id ?? null)
        .input("date", sql.DateTime2, parseMetaDate(i.invoice_date))
        .input("due", sql.DateTime2, parseMetaDate(i.due_date))
        .input("period", sql.NVarChar(100), i.billing_period ?? null)
        .input("amount", sql.Decimal(18, 2), Number.isFinite(amount) ? amount : null)
        .input("cur", sql.NVarChar(10), i.currency ?? null)
        .input("status", sql.NVarChar(50), i.payment_status ?? null)
        .input("type", sql.NVarChar(50), i.invoice_type ?? i.type ?? null).query(`
          MERGE invoices WITH (HOLDLOCK) AS t
          USING (SELECT @cid cid, @meta m) AS s ON t.client_id=s.cid AND t.meta_id=s.m
          WHEN MATCHED THEN UPDATE SET invoice_id=@inv, invoice_date=@date, due_date=@due, billing_period=@period,
            amount=@amount, currency=@cur, payment_status=@status, type=@type
          WHEN NOT MATCHED THEN INSERT (client_id, meta_id, invoice_id, invoice_date, due_date, billing_period, amount, currency, payment_status, type)
            VALUES (@cid, @meta, @inv, @date, @due, @period, @amount, @cur, @status, @type);`);
    }
    await pool
      .request()
      .input("id", sql.Int, c.id)
      .query("UPDATE clients SET last_invoice_error=NULL, last_invoices_synced_at=SYSUTCDATETIME() WHERE id=@id");
    return { count: invoices.length };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await pool
      .request()
      .input("id", sql.Int, c.id)
      .input("err", sql.NVarChar(500), msg)
      .query("UPDATE clients SET last_invoice_error=@err WHERE id=@id");
    return { count: 0, error: msg };
  }
}
type Agg = { day: string; phone: string; country: string; cat: string; type: string; volume: number; cost: number };

/** Sincroniza los últimos `days` días de un cliente (upsert idempotente). */
export async function syncClient(clientId: number, days = 7, opts: { invoices?: boolean } = {}) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("id", sql.Int, clientId)
    .query<ClientRow>("SELECT id, waba_id, access_token_enc, currency, business_id FROM clients WHERE id=@id");
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
    // Las facturas cambian poco: solo en la sincronización manual y en la diaria.
    const inv = opts.invoices ? await syncInvoices(c, token) : null;
    return { rows: rows.size, invoices: inv?.count ?? null, invoiceError: inv?.error ?? null };
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
  const results: { id: number; rows?: number; invoices?: number | null; invoiceError?: string | null; error?: string }[] =
    [];
  for (const { id } of recordset) {
    try {
      const r = await syncClient(id, days, { invoices: true });
      results.push({ id, rows: r.rows, invoices: r.invoices, invoiceError: r.invoiceError });
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
