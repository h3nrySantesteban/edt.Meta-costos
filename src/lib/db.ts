import sql from "mssql";

declare global {
  var __pool: Promise<sql.ConnectionPool> | undefined;
}

function config(): sql.config {
  return {
    server: process.env.DB_SERVER!,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_CERT === "true",
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
  };
}

export function getPool() {
  if (!global.__pool) {
    global.__pool = new sql.ConnectionPool(config())
      .connect()
      .catch((err) => {
        global.__pool = undefined;
        throw err;
      });
  }
  return global.__pool;
}

export { sql };
