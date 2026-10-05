import { formatMoney } from "@/lib/utils";

export function DailyChart({
  data,
  currency,
}: {
  data: { key: string; cost: number }[];
  currency: string;
}) {
  const max = Math.max(...data.map((d) => d.cost), 0);
  if (data.length === 0 || max === 0) {
    return <p className="text-sm text-foreground/50">Sin gastos en el período seleccionado.</p>;
  }

  return (
    <div className="flex h-44 items-end gap-1">
      {data.map((d) => (
        <div key={d.key} className="group relative flex h-full min-w-0 flex-1 items-end">
          <div
            className="w-full rounded-t bg-foreground/70 transition-colors group-hover:bg-foreground"
            style={{ height: `${Math.max((d.cost / max) * 100, 2)}%` }}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-surface bg-background px-2.5 py-1.5 text-xs group-hover:block">
            <p className="text-foreground/50">{d.key}</p>
            <p className="font-medium">{formatMoney(d.cost, currency)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
