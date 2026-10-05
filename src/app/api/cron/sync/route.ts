import { NextResponse, type NextRequest } from "next/server";
import { syncAllClients } from "@/lib/sync";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel envía CRON_SECRET como Bearer; debe tener el mismo valor que APP_SECRET.
  const secret = process.env.APP_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  // Ventana de 7 días: reconcilia ajustes tardíos de Meta.
  const results = await syncAllClients(7);
  return NextResponse.json({ results });
}
