import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Session } from "./session";

export const SELECTED_CLIENT_COOKIE = "selected_client";

export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
});

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
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
