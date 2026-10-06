import { Car, DollarSign, MessageSquare, Route, Tag } from "lucide-react";
import { Suspense } from "react";
import { after } from "next/server";
import { ContentSkeleton } from "@/components/Skeletons";
import { maybeAutoSync } from "@/lib/sync";
import { getTrips } from "@/lib/trips";
import { getActiveClientId, requireSession } from "@/lib/auth";
import { getClient, getCosts, getTotals } from "@/lib/costs";
import { resolveRange } from "@/lib/range";
import { formatDateTime, formatInt, formatMoney } from "@/lib/utils";
import { RangeFilter } from "@/components/RangeFilter";
import { DailyChart } from "@/components/DailyChart";
import { NoClient } from "@/components/NoClient";

export const maxDuration = 60;

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const clientId = await getActiveClientId(session);
  const { from, to } = resolveRange(sp.from, sp.to);
  const client = clientId ? await getClient(clientId) : null;
  if (client) after(() => maybeAutoSync(client.id));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
      <p className="mt-1 text-sm text-foreground/50">
        {client ? `Facturación de mensajería de ${client.name}.` : "Facturación de mensajería de WhatsApp."}
      </p>

      {!client ? (
        <NoClient admin={session.role === "admin"} />
      ) : (
        <>
          <div className="mt-6">
            <RangeFilter basePath="/" from={from} to={to} />
          </div>
          <Suspense key={`${client.id}|${from}|${to}`} fallback={<ContentSkeleton cards={5} />}>
            <Content
              clientId={client.id}
              currency={client.currency}
              from={from}
              to={to}
              synced={client.last_synced_at}
              isAdmin={session.role === "admin"}
            />
          </Suspense>
        </>
      )}
    </div>
  );
}

async function Content({
  clientId,
  currency,
  from,
  to,
  synced,
  isAdmin,
}: {
  clientId: number;
  currency: string;
  from: string;
  to: string;
  synced: Date | null;
  isAdmin: boolean;
}) {
  const [totals, daily, byCategory, trips] = await Promise.all([
    getTotals(clientId, from, to),
    getCosts(clientId, from, to, "day"),
    getCosts(clientId, from, to, "category"),
    getTrips(clientId, from, to),
  ]);
  const avg = totals.volume ? totals.cost / totals.volume : 0;

  const cards = [
    { label: "Gasto total", value: formatMoney(totals.cost, currency), icon: DollarSign },
    { label: "Mensajes facturados", value: formatInt(totals.volume), icon: MessageSquare },
    { label: "Costo promedio por mensaje", value: formatMoney(avg, currency), icon: Tag },
  ];
  if (trips.configured && trips.ok) {
    cards.push(
      { label: "Viajes", value: formatInt(trips.total), icon: Car },
      {
        label: "Costo de mensajería por viaje",
        value: trips.total ? formatMoney(totals.cost / trips.total, currency) : "—",
        icon: Route,
      },
    );
  }

  return (
    <>
      <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="@container min-w-0 rounded-2xl border border-surface/70 p-5">
            <Icon size={18} className="text-foreground/50" />
            <p className="mt-4 break-words font-semibold [font-size:clamp(1.1rem,8cqw,1.875rem)]">{value}</p>
            <p className="mt-1 text-sm text-foreground/60">{label}</p>
          </div>
        ))}
      </div>

      {trips.configured && !trips.ok && (
        <p className="mt-3 text-sm text-red-400">
          No se pudo obtener la cantidad de viajes{isAdmin ? `: ${trips.error}` : "."}
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-surface/70 p-5">
        <h2 className="mb-5 text-sm font-medium">Gasto diario</h2>
        <DailyChart data={daily} currency={currency} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium">Por categoría</h2>
        {byCategory.length === 0 ? (
          <p className="text-sm text-foreground/50">Sin datos.</p>
        ) : (
          <div className="flex flex-col divide-y divide-surface/70 border-y border-surface/70">
            {byCategory.map((r) => (
              <div key={r.key} className="flex items-center gap-4 py-3.5">
                <p className="min-w-0 flex-1 truncate text-sm font-medium capitalize">
                  {(r.key || "Sin categoría").toLowerCase()}
                </p>
                <p className="text-xs text-foreground/50">{formatInt(r.volume)} msgs</p>
                <p className="w-28 text-right text-sm">{formatMoney(r.cost, currency)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-foreground/40">
        Costos aproximados según Meta, no equivalen a la factura oficial.
        {synced && ` Última sincronización: ${formatDateTime(synced)}.`}
      </p>
    </>
  );
}
