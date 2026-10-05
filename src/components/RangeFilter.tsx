import Link from "next/link";
import { cn, isoDate } from "@/lib/utils";

const PRESETS = [
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
  { label: "90 días", days: 90 },
];

export function RangeFilter({
  basePath,
  from,
  to,
  extra = {},
}: {
  basePath: string;
  from: string;
  to: string;
  extra?: Record<string, string>;
}) {
  const today = isoDate(new Date());
  const monthStart = today.slice(0, 8) + "01";
  const items = [
    ...PRESETS.map((p) => ({
      label: p.label,
      from: isoDate(new Date(new Date(today).getTime() - (p.days - 1) * 86400000)),
    })),
    { label: "Este mes", from: monthStart },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((i) => {
        const qs = new URLSearchParams({ ...extra, from: i.from, to: today });
        const active = from === i.from && to === today;
        return (
          <Link
            key={i.label}
            href={`${basePath}?${qs}`}
            className={cn(
              "rounded-full border border-surface px-3.5 py-1.5 text-sm transition-colors hover:bg-surface",
              active ? "bg-surface text-foreground" : "text-foreground/60",
            )}
          >
            {i.label}
          </Link>
        );
      })}
      <form action={basePath} className="flex items-center gap-2">
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <input type="date" name="from" defaultValue={from} className="input !w-auto !py-1.5" />
        <span className="text-foreground/40">→</span>
        <input type="date" name="to" defaultValue={to} className="input !w-auto !py-1.5" />
        <button
          type="submit"
          className="h-9 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
