import { NextResponse, type NextRequest } from "next/server";
import { getActiveClientId, getSession } from "@/lib/auth";
import { getCosts, parseGroupBy } from "@/lib/costs";
import { resolveRange } from "@/lib/range";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const q = req.nextUrl.searchParams;
  let clientId = await getActiveClientId(session);
  // Admin puede pedir un cliente explícito; los clientes siempre quedan limitados al suyo.
  if (session.role === "admin" && Number(q.get("client"))) clientId = Number(q.get("client"));
  if (!clientId) return NextResponse.json({ error: "Sin cliente seleccionado" }, { status: 400 });

  const { from, to } = resolveRange(q.get("from") ?? undefined, q.get("to") ?? undefined);
  const data = await getCosts(clientId, from, to, parseGroupBy(q.get("group_by")));
  return NextResponse.json({ from, to, data });
}
