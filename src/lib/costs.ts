import "server-only";
import { getPool, sql } from "./db";

export type GroupBy = "day" | "category" | "country" | "type" | "phone";

const GROUP_COL: Record<GroupBy, string> = {
  day: "CONVERT(char(10), day, 23)",
  category: "pricing_category",
  country: "country",
  type: "pricing_type",
  phone: "phone_number",
};

export function parseGroupBy(v: string | null | undefined): GroupBy {
  return v && v in GROUP_COL ? (v as GroupBy) : "day";
}

export type CostRow = { key: string; volume: number; cost: number };

export async function getCosts(clientId: number, from: string, to: string, groupBy: GroupBy) {
  const pool = await getPool();
  const col = GROUP_COL[groupBy];
  const { recordset } = await pool
    .request()
    .input("cid", sql.Int, clientId)
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query<CostRow>(
      `SELECT ${col} AS [key], SUM(volume) AS volume, CAST(SUM(cost) AS FLOAT) AS cost
         FROM message_costs
        WHERE client_id=@cid AND day BETWEEN @from AND @to
        GROUP BY ${col}
        ORDER BY ${groupBy === "day" ? "[key]" : "cost DESC"}`,
    );
  return recordset;
}

export async function getTotals(clientId: number, from: string, to: string) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("cid", sql.Int, clientId)
    .input("from", sql.Date, from)
    .input("to", sql.Date, to)
    .query<{ volume: number | null; cost: number | null }>(
      `SELECT SUM(volume) volume, CAST(SUM(cost) AS FLOAT) cost
         FROM message_costs WHERE client_id=@cid AND day BETWEEN @from AND @to`,
    );
  const r = recordset[0];
  return { volume: r?.volume ?? 0, cost: r?.cost ?? 0 };
}

export type ClientInfo = {
  id: number;
  name: string;
  waba_id: string | null;
  currency: string;
  active: boolean;
  last_synced_at: Date | null;
  last_sync_error: string | null;
  has_token: boolean;
};

const CLIENT_COLS = `id, name, waba_id, currency, active, last_synced_at, last_sync_error,
  CAST(CASE WHEN access_token_enc IS NULL THEN 0 ELSE 1 END AS BIT) AS has_token`;

export async function listClients() {
  const pool = await getPool();
  const { recordset } = await pool.request().query<ClientInfo>(`SELECT ${CLIENT_COLS} FROM clients ORDER BY name`);
  return recordset;
}

export async function getClient(id: number) {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("id", sql.Int, id)
    .query<ClientInfo>(`SELECT ${CLIENT_COLS} FROM clients WHERE id=@id`);
  return recordset[0] ?? null;
}
