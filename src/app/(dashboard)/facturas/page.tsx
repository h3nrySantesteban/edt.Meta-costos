import { FileText } from "lucide-react";
import { getActiveClientId, requireSession } from "@/lib/auth";
import { getClient, listInvoices } from "@/lib/costs";
import { formatDate, formatMoney } from "@/lib/utils";
import { NoClient } from "@/components/NoClient";
import { DownloadInvoiceButton } from "@/components/DownloadInvoiceButton";

const STATUS: Record<string, string> = {
  paid: "Pagada",
  partially_paid: "Pago parcial",
  unpaid: "Pendiente",
  not_paid: "Pendiente",
};

function statusLabel(s: string | null) {
  if (!s) return null;
  return STATUS[s.toLowerCase().replace(/\s+/g, "_")] ?? s;
}

export default async function FacturasPage() {
  const session = await requireSession();
  const clientId = await getActiveClientId(session);
  const client = clientId ? await getClient(clientId) : null;
  const invoices = client ? await listInvoices(client.id) : [];
  const isAdmin = session.role === "admin";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Facturas</h1>
      <p className="mt-1 text-sm text-foreground/50">
        {client ? `Facturas emitidas por Meta a ${client.name}.` : "Facturas emitidas por Meta."}
      </p>

      {!client ? (
        <NoClient admin={isAdmin} />
      ) : invoices.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-2xl border border-surface/70 px-6 py-14 text-center">
          <FileText size={22} className="text-foreground/40" />
          <p className="mt-3 text-sm font-medium">Todavía no hay facturas</p>
          <p className="mt-1 text-sm text-foreground/50">
            {isAdmin && client.last_invoice_error
              ? `Último error al traerlas: ${client.last_invoice_error}`
              : "Aparecen acá cuando Meta las emite."}
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col divide-y divide-surface/70 border-y border-surface/70">
          {invoices.map((i) => {
            const status = statusLabel(i.payment_status);
            const label = i.invoice_id ? `Factura ${i.invoice_id}` : "Factura";
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{label}</p>
                  <p className="mt-0.5 truncate text-xs text-foreground/50">
                    {i.invoice_date ? `Emitida el ${formatDate(i.invoice_date.toISOString())}` : "Sin fecha"}
                    {i.billing_period ? ` · Período ${i.billing_period}` : ""}
                    {status ? ` · ${status}` : ""}
                  </p>
                </div>
                {i.amount !== null && (
                  <p className="text-sm">{formatMoney(i.amount, i.currency ?? client.currency)}</p>
                )}
                <DownloadInvoiceButton id={i.id} name={`factura-${i.invoice_id ?? i.id}`} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
