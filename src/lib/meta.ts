import "server-only";

const BASE = "https://graph.facebook.com";
const version = () => process.env.GRAPH_API_VERSION ?? "v25.0";

export type PricingPoint = {
  start: number;
  end: number;
  phone_number?: string;
  country?: string;
  pricing_category?: string;
  pricing_type?: string;
  volume?: number;
  cost?: number;
};

async function graph<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${BASE}/${version()}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? `Graph API ${res.status}`);
  return json as T;
}

export async function fetchWabaCurrency(wabaId: string, token: string) {
  try {
    const r = await graph<{ currency?: string }>(wabaId, { fields: "currency" }, token);
    return r.currency ?? null;
  } catch {
    return null;
  }
}

/** Consulta pricing_analytics en tramos de 30 días (la API limita el rango para DAILY). */
export async function fetchPricing(wabaId: string, token: string, fromSec: number, toSec: number) {
  const points: PricingPoint[] = [];
  const STEP = 30 * 86400;
  for (let start = fromSec; start < toSec; start += STEP) {
    const end = Math.min(start + STEP, toSec);
    const fields =
      `pricing_analytics.start(${start}).end(${end}).granularity(DAILY)` +
      `.metric_types(["COST","VOLUME"])` +
      `.dimensions(["PRICING_CATEGORY","PRICING_TYPE","COUNTRY","PHONE"])`;
    const r = await graph<{ pricing_analytics?: { data?: { data_points?: PricingPoint[] }[] } }>(
      wabaId,
      { fields },
      token,
    );
    for (const d of r.pricing_analytics?.data ?? []) points.push(...(d.data_points ?? []));
  }
  return points;
}
