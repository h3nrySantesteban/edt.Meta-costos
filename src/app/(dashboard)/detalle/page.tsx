import { Suspense } from "react";
import { after } from "next/server";
import { maybeAutoSync } from "@/lib/sync";
import { getTrips } from "@/lib/trips";
import { getActiveClientId, requireSession } from "@/lib/auth";
import { getClient, getCosts, parseGroupBy, type GroupBy } from "@/lib/costs";
import { resolveRange } from "@/lib/range";
import { cn, formatDate, formatInt, formatMoney } from "@/lib/utils";
import { RangeFilter } from "@/components/RangeFilter";
import { NavLink } from "@/components/Navigation";
import { NoClient } from "@/components/NoClient";
import { ContentSkeleton } from "@/components/Skeletons";

const GROUPS: { value: GroupBy; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "category", label: "Categoría" },
  { value: "country", label: "País" },
  { value: "type", label: "Tipo de precio" },
  { value: "phone", label: "Número" },
];

export const maxDuration = 60;

export default async function DetallePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; group_by?: string }>;
}) {
  const sp = await searchParams;
  const session = await requireSession();
  const clientId = await getActiveClientId(session);
  const { from, to } = resolveRange(sp.from, sp.to);
  const groupBy = parseGroupBy(sp.group_by);
  const client = clientId ? await getClient(clientId) : null;
  if (client) after(() => maybeAutoSync(client.id));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Detalle</h1>
      <p className="mt-1 text-sm text-foreground/50">Desglose de mensajes y costos.</p>

      {!client ? (
        <NoClient admin={session.role === "admin"} />
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {GROUPS.map((g) => (
                <NavLink
                  key={g.value}
                  href={`/detalle?${new URLSearchParams({ from, to, group_by: g.value })}`}
                  active={g.value === groupBy}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-surface",
                    g.value === groupBy ? "bg-surface text-foreground" : "text-foreground/60",
                  )}
                >
                  {g.label}
                </NavLink>
              ))}
            </div>
            <RangeFilter basePath="/detalle" from={from} to={to} extra={{ group_by: groupBy }} />
          </div>

          <Suspense key={`${client.id}|${from}|${to}|${groupBy}`} fallback={<Skeleton />}>
            <Results clientId={client.id} currency={client.currency} from={from} to={to} groupBy={groupBy} />
          </Suspense>
        </>
      )}
    </div>
  );
}

function Skeleton() {
  return <ContentSkeleton cards={0} />;
}

async function Results({
  clientId,
  currency,
  from,
  to,
  groupBy,
}: {
  clientId: number;
  currency: string;
  from: string;
  to: string;
  groupBy: GroupBy;
}) {
  const [data, trips] = await Promise.all([
    getCosts(clientId, from, to, groupBy),
    groupBy === "day" ? getTrips(clientId, from, to) : Promise.resolve(null),
  ]);
  const tripsByDay = trips && trips.configured && trips.ok ? trips.byDay : null;

  let rows: { key: string; volume: number; cost: number; trips: number }[] = data.map((r) => ({
    ...r,
    trips: tripsByDay?.[r.key] ?? 0,
  }));
  if (groupBy === "day") {
    // Incluye días con viajes aunque no tengan mensajes; del más reciente al más lejano.
    if (tripsByDay) {
      const known = new Set(rows.map((r) => r.key));
      for (const [key, n] of Object.entries(tripsByDay)) {
        if (!known.has(key)) rows.push({ key, volume: 0, cost: 0, trips: n });
      }
    }
    rows = rows.sort((a, b) => b.key.localeCompare(a.key));
  }

  if (rows.length === 0) {
    return <p className="mt-10 text-sm text-foreground/50">Sin datos en el período seleccionado.</p>;
  }

  return (
    <div className="mt-8 flex flex-col divide-y divide-surface/70 border-y border-surface/70">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center gap-4 py-3.5">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {groupBy === "day" ? formatDate(r.key) : r.key || "—"}
          </p>
          {tripsByDay && <p className="w-24 text-right text-xs text-foreground/50">{formatInt(r.trips)} viajes</p>}
          <p className="text-xs text-foreground/50">{formatInt(r.volume)} msgs</p>
          <p className="w-28 text-right text-sm">{formatMoney(r.cost, currency)}</p>
        </div>
      ))}
      <div className="flex items-center gap-4 py-3.5 font-medium">
        <p className="flex-1 text-sm">Total</p>
        {tripsByDay && (
          <p className="w-24 text-right text-xs text-foreground/50">
            {formatInt(rows.reduce((a, r) => a + r.trips, 0))} viajes
          </p>
        )}
        <p className="text-xs text-foreground/50">{formatInt(rows.reduce((a, r) => a + r.volume, 0))} msgs</p>
        <p className="w-28 text-right text-sm">{formatMoney(rows.reduce((a, r) => a + r.cost, 0), currency)}</p>
      </div>
    </div>
  );
}
