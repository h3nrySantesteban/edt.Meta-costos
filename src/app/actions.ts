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
import { getTrips, parseUserIds } from "@/lib/trips";
import { isoDate } from "@/lib/utils";
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

  // Base de datos de viajes del cliente (opcional)
  const tServer = String(formData.get("trips_server") ?? "").trim() || null;
  const tPort = Number(formData.get("trips_port")) || 1433;
  const tDb = String(formData.get("trips_db") ?? "").trim() || null;
  const tUser = String(formData.get("trips_user") ?? "").trim() || null;
  const tPass = String(formData.get("trips_password") ?? "");
  const tUsersRaw = String(formData.get("trips_users") ?? "").trim();
  if (tServer) {
    if (!tDb || !tUser) return { error: "Completá base de datos y usuario de la DB de viajes." };
    if (!parseUserIds(tUsersRaw)) {
      return { error: "Los números de usuario telefonista deben ser enteros separados por coma." };
    }
  }

  const pool = await getPool();
  const req = pool
    .request()
    .input("name", sql.NVarChar(200), name)
    .input("waba", sql.NVarChar(50), waba)
    .input("active", sql.Bit, active)
    .input("tok", sql.NVarChar(sql.MAX), token ? encryptToken(token) : null)
    .input("tserver", sql.NVarChar(200), tServer)
    .input("tport", sql.Int, tServer ? tPort : null)
    .input("tdb", sql.NVarChar(200), tServer ? tDb : null)
    .input("tuser", sql.NVarChar(200), tServer ? tUser : null)
    .input("tpass", sql.NVarChar(sql.MAX), tServer && tPass ? encryptToken(tPass) : null)
    .input("tenc", sql.Bit, formData.get("trips_encrypt") === "on")
    .input("ttrust", sql.Bit, formData.get("trips_trust") === "on")
    .input("tusers", sql.NVarChar(500), tServer ? tUsersRaw : null);

  if (id) {
    await req.input("id", sql.Int, id).query(`
      UPDATE clients SET name=@name, waba_id=@waba, active=@active,
        access_token_enc=COALESCE(@tok, access_token_enc),
        trips_db_server=@tserver, trips_db_port=@tport, trips_db_name=@tdb, trips_db_user=@tuser,
        trips_db_password_enc=CASE WHEN @tserver IS NULL THEN NULL ELSE COALESCE(@tpass, trips_db_password_enc) END,
        trips_db_encrypt=@tenc, trips_db_trust_cert=@ttrust, trips_users=@tusers
      WHERE id=@id`);
  } else {
    await req.query(`
      INSERT INTO clients (name, waba_id, active, access_token_enc, trips_db_server, trips_db_port, trips_db_name,
                           trips_db_user, trips_db_password_enc, trips_db_encrypt, trips_db_trust_cert, trips_users)
      VALUES (@name, @waba, @active, @tok, @tserver, @tport, @tdb, @tuser, @tpass, @tenc, @ttrust, @tusers)`);
  }
  revalidatePath("/", "layout");
  return { ok: "Guardado." };
}

export async function createClientUser(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const clientId = Number(formData.get("client_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!clientId || !email) return { error: "El usuario es obligatorio." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const pool = await getPool();
  try {
    await pool
      .request()
      .input("email", sql.NVarChar(200), email)
      .input("hash", sql.NVarChar(100), await bcrypt.hash(password, 10))
      .input("enc", sql.NVarChar(sql.MAX), encryptToken(password))
      .input("cid", sql.Int, clientId)
      .query(
        "INSERT INTO users (email, password_hash, password_enc, role, client_id) VALUES (@email, @hash, @enc, 'client', @cid)",
      );
  } catch {
    return { error: "Ya existe un usuario con ese nombre." };
  }
  revalidatePath("/clientes");
  return { ok: "Usuario creado." };
}

export async function deleteClientUser(userId: number): Promise<FormState> {
  await requireAdmin();
  if (!Number.isInteger(userId) || userId <= 0) return { error: "Usuario inválido." };

  const pool = await getPool();
  const res = await pool
    .request()
    .input("id", sql.Int, userId)
    .query("DELETE FROM users WHERE id=@id AND role='client'");
  if (!res.rowsAffected[0]) return { error: "Usuario no encontrado." };
  revalidatePath("/clientes");
  return { ok: "Usuario eliminado." };
}

export async function resetUserPassword(_: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const userId = Number(formData.get("user_id"));
  const password = String(formData.get("password") ?? "");
  if (!userId) return { error: "Usuario inválido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const pool = await getPool();
  const res = await pool
    .request()
    .input("id", sql.Int, userId)
    .input("hash", sql.NVarChar(100), await bcrypt.hash(password, 10))
    .input("enc", sql.NVarChar(sql.MAX), encryptToken(password))
    .query("UPDATE users SET password_hash=@hash, password_enc=@enc WHERE id=@id AND role='client'");
  if (!res.rowsAffected[0]) return { error: "Usuario no encontrado." };
  revalidatePath("/clientes");
  return { ok: "Contraseña actualizada." };
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

export async function testTripsDb(clientId: number): Promise<FormState> {
  await requireAdmin();
  const to = isoDate(new Date());
  const from = isoDate(new Date(Date.now() - 6 * 86400000));
  const r = await getTrips(clientId, from, to);
  if (!r.configured) return { error: "Guardá primero los datos de la base de viajes." };
  if (!r.ok) return { error: r.error };
  return { ok: `Conexión correcta: ${r.total} viajes en los últimos 7 días.` };
}
