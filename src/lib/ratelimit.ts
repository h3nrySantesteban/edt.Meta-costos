import "server-only";
import { getPool, sql } from "./db";

export const MAX_ATTEMPTS = 3;
const BASE_LOCK_SEC = 30; // 30s, 60s, 120s, 240s, ...
const MAX_LOCK_SEC = 60 * 60;
const RESET_AFTER_MS = 24 * 60 * 60 * 1000; // sin actividad por 24h se olvida el historial

type Row = { fails: number; level: number; locked_until: Date | null; updated_at: Date };

async function load(key: string): Promise<Row | null> {
  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("key", sql.NVarChar(260), key)
    .query<Row>("SELECT fails, level, locked_until, updated_at FROM login_attempts WHERE [key]=@key");
  return recordset[0] ?? null;
}

/** Segundos restantes de bloqueo para el conjunto de claves (0 si ninguna está bloqueada). */
export async function lockedSeconds(keys: string[]) {
  const now = Date.now();
  let max = 0;
  for (const k of keys) {
    const row = await load(k);
    if (row?.locked_until) max = Math.max(max, Math.ceil((row.locked_until.getTime() - now) / 1000));
  }
  return Math.max(max, 0);
}

/** Registra un fallo. Devuelve segundos de bloqueo si este fallo lo disparó, y los intentos restantes. */
export async function recordFailure(keys: string[]) {
  const pool = await getPool();
  const now = Date.now();
  let lock = 0;
  let remaining = MAX_ATTEMPTS;

  for (const key of keys) {
    const row = await load(key);
    const stale = !row || now - row.updated_at.getTime() > RESET_AFTER_MS;
    let fails = stale ? 0 : row.fails;
    let level = stale ? 0 : row.level;
    let lockedUntil: Date | null = stale ? null : row.locked_until;

    fails += 1;
    if (fails >= MAX_ATTEMPTS) {
      level += 1;
      const sec = Math.min(BASE_LOCK_SEC * 2 ** (level - 1), MAX_LOCK_SEC);
      lockedUntil = new Date(now + sec * 1000);
      fails = 0;
      lock = Math.max(lock, sec);
    }
    remaining = Math.min(remaining, MAX_ATTEMPTS - fails);

    await pool
      .request()
      .input("key", sql.NVarChar(260), key)
      .input("fails", sql.Int, fails)
      .input("level", sql.Int, level)
      .input("until", sql.DateTime2, lockedUntil)
      .query(`
        MERGE login_attempts WITH (HOLDLOCK) AS t
        USING (SELECT @key AS [key]) AS s ON t.[key]=s.[key]
        WHEN MATCHED THEN UPDATE SET fails=@fails, level=@level, locked_until=@until, updated_at=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT ([key], fails, level, locked_until) VALUES (@key, @fails, @level, @until);`);
  }
  return { lock, remaining };
}

export async function clearFailures(keys: string[]) {
  const pool = await getPool();
  for (const key of keys) {
    await pool.request().input("key", sql.NVarChar(260), key).query("DELETE FROM login_attempts WHERE [key]=@key");
  }
}

export function formatWait(sec: number) {
  if (sec < 60) return `${sec} segundos`;
  const m = Math.ceil(sec / 60);
  return m === 1 ? "1 minuto" : `${m} minutos`;
}
