import { cn, isoDate } from "@/lib/utils";
import { NavLink } from "@/components/Navigation";
import { DateRangeForm } from "@/components/DateRangeForm";

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
          <NavLink
            key={i.label}
            href={`${basePath}?${qs}`}
            active={active}
            className={cn(
              "flex items-center gap-2 rounded-full border border-surface px-3.5 py-1.5 text-sm transition-colors hover:bg-surface",
              active ? "bg-surface text-foreground" : "text-foreground/60",
            )}
          >
            {i.label}
          </NavLink>
        );
      })}
      <DateRangeForm basePath={basePath} from={from} to={to} extra={extra} />
    </div>
  );
}
