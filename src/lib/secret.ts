import { hkdfSync } from "node:crypto";

/** Deriva una clave de 32 bytes distinta por propósito a partir de APP_SECRET. */
export function deriveKey(purpose: "session" | "tokens") {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) throw new Error("Falta APP_SECRET (mínimo 32 caracteres).");
  return Buffer.from(hkdfSync("sha256", secret, "whatsapp-costos", purpose, 32));
}
