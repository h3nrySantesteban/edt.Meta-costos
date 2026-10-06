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

export type MetaInvoice = {
  id: string;
  invoice_id?: string;
  invoice_date?: string;
  due_date?: string;
  billing_period?: string;
  amount?: string;
  currency?: string;
  payment_status?: string;
  type?: string;
  invoice_type?: string;
};

/** Business propietario de la cuenta de WhatsApp (de ahí salen las facturas). */
export async function fetchOwnerBusinessId(wabaId: string, token: string) {
  try {
    const r = await graph<{ owner_business_info?: { id?: string } }>(
      wabaId,
      { fields: "owner_business_info" },
      token,
    );
    return r.owner_business_info?.id ?? null;
  } catch {
    return null;
  }
}

const INVOICE_FIELDS = "id,invoice_id,invoice_date,due_date,billing_period,amount,currency,payment_status,type,invoice_type";

/** Facturas de Meta del business en los últimos `months` meses. */
export async function fetchInvoices(businessId: string, token: string, months = 12) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCMonth(start.getUTCMonth() - months);
  const out: MetaInvoice[] = [];

  type Page = { data?: MetaInvoice[]; paging?: { next?: string } };
  let page = await graph<Page>(
    `${businessId}/business_invoices`,
    {
      fields: INVOICE_FIELDS,
      start_date: start.toISOString().slice(0, 10),
      end_date: end.toISOString().slice(0, 10),
      limit: "100",
    },
    token,
  );
  for (let i = 0; i < 10; i++) {
    out.push(...(page.data ?? []));
    const next = page.paging?.next;
    if (!next || !next.startsWith("https://graph.facebook.com/")) break;
    const res = await fetch(next, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `Graph API ${res.status}`);
    page = json as Page;
  }
  return out;
}

/** Descarga el PDF de una factura (pide un enlace temporal fresco en cada descarga). */
export async function downloadInvoicePdf(businessId: string, token: string, rootId: string) {
  const r = await graph<{ data?: { cdn_download_uri?: string; download_uri?: string }[] }>(
    `${businessId}/business_invoices`,
    { root_id: rootId, fields: "cdn_download_uri,download_uri" },
    token,
  );
  const item = r.data?.[0];
  const link = item?.cdn_download_uri ?? item?.download_uri;
  if (!link) throw new Error("Meta no devolvió un enlace de descarga para esta factura.");
  const url = new URL(link);
  if (url.protocol !== "https:") throw new Error("Enlace de descarga inválido.");

  // El enlace del CDN es público y temporal; el otro puede requerir el token.
  const res = await fetch(url, {
    headers: item?.cdn_download_uri ? undefined : { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("pdf")) throw new Error("No se pudo obtener el PDF de Meta.");
  return res;
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
