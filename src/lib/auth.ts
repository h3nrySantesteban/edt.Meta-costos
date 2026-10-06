import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPool, sql } from "./db";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

export const SELECTED_CLIENT_COOKIE = "selected_client";

export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  // La sesión firmada solo vale si el usuario sigue existiendo (p. ej. no fue eliminado).
  const pool = await getPool();
  const { recordset } = await pool.request().input("id", sql.Int, s.uid).query("SELECT 1 AS ok FROM users WHERE id=@id");
  return recordset.length ? s : null;
});

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login?expired=1");
  return s;
}

export async function requireAdmin() {
  const s = await requireSession();
  if (s.role !== "admin") redirect("/");
  return s;
}

/** Cliente cuyos datos se muestran: el propio para clientes, el seleccionado para admin. */
export async function getActiveClientId(s: Session): Promise<number | null> {
  if (s.role === "client") return s.cid;
  const store = await cookies();
  const v = Number(store.get(SELECTED_CLIENT_COOKIE)?.value);
  return Number.isInteger(v) && v > 0 ? v : null;
}
