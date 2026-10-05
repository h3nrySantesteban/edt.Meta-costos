import { NextResponse, type NextRequest } from "next/server";
import { syncAllClients } from "@/lib/sync";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Ventana de 7 días: reconcilia ajustes tardíos de Meta.
  const results = await syncAllClients(7);
  return NextResponse.json({ results });
}
