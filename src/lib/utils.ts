import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatInt(value: number) {
  return new Intl.NumberFormat("es").format(value);
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** "2026-10-05" -> "05-10-2026" */
export function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}-${m}-${y}`;
}

/** Fecha y hora en horario de Argentina: "05-10-2026 14:30" */
export function formatDateTime(date: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}
