import "server-only";
import { getPool, sql } from "./db";
import { decryptToken } from "./crypto";
import { isoDate } from "./utils";

export type TripsResult =
  | { configured: false }
  | { configured: true; ok: true; total: number; byDay: Record<string, number> }
  | { configured: true; ok: false; error: string };

/** "9897, 9898" -> [9897, 9898]. Devuelve null si algún valor no es un entero positivo. */
export function parseUserIds(raw: string): number[] | null {
  const parts = raw
    .split(/[,\s;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0 || parts.length > 50) return null;
  const ids = parts.map((p) => (/^\d{1,10}$/.test(p) ? Number(p) : NaN));
  return ids.some((n) => !Number.isSafeInteger(n) || n <= 0 || n > 2147483647) ? null : ids;
}

type Cfg = {
  trips_db_server: string | null;
  trips_db_port: number | null;
  trips_db_name: string | null;
  trips_db_user: string | null;
  trips_db_password_enc: string | null;
  trips_db_encrypt: boolean;
  trips_db_trust_cert: boolean;
  trips_users: string | null;
};

/** Cuenta viajes por día en la base del cliente (consulta de solo lectura, parametrizada). */
export async function getTrips(clientId: number, from: string, to: string): Promise<TripsResult> {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("id", sql.Int, clientId)
    .query<Cfg>(
      `SELECT trips_db_server, trips_db_port, trips_db_name, trips_db_user, trips_db_password_enc,
              trips_db_encrypt, trips_db_trust_cert, trips_users FROM clients WHERE id=@id`,
    );
  const c = recordset[0];
  if (!c?.trips_db_server || !c.trips_db_name || !c.trips_db_user || !c.trips_users) return { configured: false };

  const ids = parseUserIds(c.trips_users);
  if (!ids) return { configured: true, ok: false, error: "Los números de usuario telefonista no son válidos." };

  let remote: sql.ConnectionPool | undefined;
  try {
    remote = await new sql.ConnectionPool({
      server: c.trips_db_server,
      port: c.trips_db_port ?? 1433,
      database: c.trips_db_name,
      user: c.trips_db_user,
      password: c.trips_db_password_enc ? decryptToken(c.trips_db_password_enc) : "",
      options: { encrypt: c.trips_db_encrypt, trustServerCertificate: c.trips_db_trust_cert },
      connectionTimeout: 8000,
      requestTimeout: 15000,
      pool: { max: 1 },
    }).connect();

    const req = remote.request();
    ids.forEach((id, i) => req.input(`u${i}`, sql.Int, id));
    req.input("from", sql.Date, from);
    req.input("toExcl", sql.Date, isoDate(new Date(Date.parse(to) + 86400000)));

    const res = await req.query<{ day: string; trips: number }>(
      `SELECT CONVERT(char(10), fecha_hora_entrada, 23) AS day, COUNT(*) AS trips
         FROM VIAJES_HISTORICOS
        WHERE nro_usuario_telefonista IN (${ids.map((_, i) => `@u${i}`).join(",")})
          AND fecha_hora_entrada >= @from AND fecha_hora_entrada < @toExcl
        GROUP BY CONVERT(char(10), fecha_hora_entrada, 23)`,
    );

    const byDay: Record<string, number> = {};
    let total = 0;
    for (const r of res.recordset) {
      byDay[r.day] = r.trips;
      total += r.trips;
    }
    return { configured: true, ok: true, total, byDay };
  } catch (e) {
    console.error("consulta de viajes falló", e);
    return { configured: true, ok: false, error: e instanceof Error ? e.message.slice(0, 300) : "Error de conexión." };
  } finally {
    await remote?.close().catch(() => {});
  }
}
