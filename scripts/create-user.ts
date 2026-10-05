// Uso: npm run user:create -- admin@correo.com 'contraseña' [admin|client] [client_id]
import bcrypt from "bcryptjs";
import sql from "mssql";

async function main() {
  const [email, password, role = "admin", clientId] = process.argv.slice(2);
  if (!email || !password || (role !== "admin" && role !== "client")) {
    throw new Error("Uso: npm run user:create -- <email> <password> [admin|client] [client_id]");
  }
  if (role === "client" && !clientId) throw new Error("Los usuarios 'client' requieren client_id.");

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

  await pool
    .request()
    .input("email", sql.NVarChar(200), email.toLowerCase())
    .input("hash", sql.NVarChar(100), await bcrypt.hash(password, 10))
    .input("role", sql.NVarChar(10), role)
    .input("cid", sql.Int, clientId ? Number(clientId) : null)
    .query("INSERT INTO users (email, password_hash, role, client_id) VALUES (@email, @hash, @role, @cid)");
  console.log(`Usuario ${email} (${role}) creado.`);
  await pool.close();
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
