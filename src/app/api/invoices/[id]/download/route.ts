import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getPool, sql } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { downloadInvoicePdf } from "@/lib/meta";

export const maxDuration = 60;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Factura inválida" }, { status: 400 });

  const pool = await getPool();
  const { recordset } = await pool
    .request()
    .input("id", sql.Int, id)
    .query<{
      client_id: number;
      meta_id: string;
      invoice_id: string | null;
      business_id: string | null;
      access_token_enc: string | null;
    }>(
      `SELECT i.client_id, i.meta_id, i.invoice_id, c.business_id, c.access_token_enc
         FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.id=@id`,
    );
  const inv = recordset[0];
  // Un cliente solo accede a sus propias facturas; para el resto responde igual que si no existiera.
  if (!inv || (session.role === "client" && session.cid !== inv.client_id)) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }
  if (!inv.business_id || !inv.access_token_enc) {
    return NextResponse.json({ error: "El cliente no tiene Business ID o token configurado." }, { status: 409 });
  }

  try {
    const pdf = await downloadInvoicePdf(inv.business_id, decryptToken(inv.access_token_enc), inv.meta_id);
    const name = `factura-${(inv.invoice_id ?? inv.meta_id).replace(/[^\w.-]/g, "")}.pdf`;
    return new Response(pdf.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("descarga de factura falló", e);
    const msg = e instanceof Error ? e.message : "No se pudo descargar la factura.";
    // Al admin le mostramos el motivo; al cliente un mensaje genérico.
    return NextResponse.json(
      { error: session.role === "admin" ? msg : "No se pudo descargar la factura. Intentá de nuevo más tarde." },
      { status: 502 },
    );
  }
}
