"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPool, sql } from "@/lib/db";
import { requireAdmin, SELECTED_CLIENT_COOKIE } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession } from "@/lib/session";
import { encryptToken } from "@/lib/crypto";
import { syncClient } from "@/lib/sync";
import { clearFailures, formatWait, lockedSeconds, recordFailure } from "@/lib/ratelimit";

export type FormState = { error?: string; ok?: string; retryAfter?: number } | undefined;

// Hash para igualar tiempos cuando el usuario no existe.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Usuario o contraseña incorrectos." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
  const keys = [`e:${email}`.slice(0, 260), `i:${ip}`.slice(0, 260)];

  const wait = await lockedSeconds(keys);
  if (wait > 0) {
    return { error: `Demasiados intentos. Probá de nuevo en ${formatWait(wait)}.`, retryAfter: wait };
  }

  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("email", sql.NVarChar(200), email)
    .query<{ id: number; password_hash: string; role: "admin" | "client"; client_id: number | null; active: boolean | null }>(
      `SELECT u.id, u.password_hash, u.role, u.client_id, c.active
         FROM users u LEFT JOIN clients c ON c.id = u.client_id WHERE u.email=@email`,
    );
  const u = recordset[0];
  const ok = await bcrypt.compare(password, u?.password_hash ?? DUMMY_HASH);
  if (!u || !ok || (u.role === "client" && !u.active)) {
    const { lock, remaining } = await recordFailure(keys);
    if (lock > 0) {
      return { error: `Demasiados intentos. Probá de nuevo en ${formatWait(lock)}.`, retryAfter: lock };
    }
    return {
      error: `Usuario o contraseña incorrectos. Te ${remaining === 1 ? "queda 1 intento" : `quedan ${remaining} intentos`}.`,
    };
  }
  await clearFailures([keys[0]]);

  const token = await signSession({ uid: u.id, role: u.role, cid: u.client_id, email });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(SELECTED_CLIENT_COOKIE);
  redirect("/login");
}

export async function selectClient(clientId: number) {
  await requireAdmin();
  const store = await cookies();
  store.set(SELECTED_CLIENT_COOKIE, String(clientId), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}

export async function saveClient(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const waba = String(formData.get("waba_id") ?? "").trim() || null;
  const token = String(formData.get("token") ?? "").trim();
  const active = formData.get("active") === "on";
  if (!name) return { error: "El nombre es obligatorio." };

  const pool = await getPool();
  const req = pool
    .request()
    .input("name", sql.NVarChar(200), name)
    .input("waba", sql.NVarChar(50), waba)
    .input("active", sql.Bit, active)
    .input("tok", sql.NVarChar(sql.MAX), token ? encryptToken(token) : null);

  if (id) {
    await req
      .input("id", sql.Int, id)
      .query(
        "UPDATE clients SET name=@name, waba_id=@waba, active=@active, access_token_enc=COALESCE(@tok, access_token_enc) WHERE id=@id",
      );
  } else {
    await req.query(
      "INSERT INTO clients (name, waba_id, active, access_token_enc) VALUES (@name, @waba, @active, @tok)",
    );
  }
  revalidatePath("/", "layout");
  return { ok: "Guardado." };
}

export async function createClientUser(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const clientId = Number(formData.get("client_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!clientId || !email) return { error: "Email obligatorio." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const pool = await getPool();
  try {
    await pool
      .request()
      .input("email", sql.NVarChar(200), email)
      .input("hash", sql.NVarChar(100), await bcrypt.hash(password, 10))
      .input("cid", sql.Int, clientId)
      .query("INSERT INTO users (email, password_hash, role, client_id) VALUES (@email, @hash, 'client', @cid)");
  } catch {
    return { error: "Ya existe un usuario con ese email." };
  }
  return { ok: "Usuario creado." };
}

export async function syncNow(clientId: number, days: number): Promise<FormState> {
  await requireAdmin();
  try {
    const rows = await syncClient(clientId, Math.min(Math.max(days, 1), 365));
    revalidatePath("/", "layout");
    return { ok: `Sincronizado (${rows} filas).` };
  } catch (e) {
    revalidatePath("/clientes");
    return { error: e instanceof Error ? e.message : "Error al sincronizar." };
  }
}
