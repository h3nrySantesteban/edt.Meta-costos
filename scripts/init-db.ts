import { readFileSync } from "node:fs";
import sql from "mssql";

async function main() {
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER!,
    port: Number(process.env.DB_PORT ?? 1433),
    database: process.env.DB_NAME!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate: process.env.DB_TRUST_CERT === "true",
    },
  }).connect();
  await pool.request().batch(readFileSync("sql/schema.sql", "utf8"));
  console.log("Esquema aplicado.");
  await pool.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
