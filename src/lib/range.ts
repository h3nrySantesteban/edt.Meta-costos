import { isoDate } from "./utils";

const RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(from?: string, to?: string, days = 30) {
  const end = to && RE.test(to) ? to : isoDate(new Date());
  const start =
    from && RE.test(from) ? from : isoDate(new Date(new Date(end).getTime() - (days - 1) * 86400000));
  return start <= end ? { from: start, to: end } : { from: end, to: start };
}
