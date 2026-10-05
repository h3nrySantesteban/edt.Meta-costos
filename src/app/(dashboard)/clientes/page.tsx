import { ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/costs";
import { formatDateTime } from "@/lib/utils";
import { ClientForm, SyncButton, TripsTestButton, UserForm } from "@/components/ClientForms";

export default async function ClientesPage() {
  await requireAdmin();
  const clients = await listClients();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
      <p className="mt-1 text-sm text-foreground/50">
        Configurá la cuenta de WhatsApp Business, el acceso y la sincronización de cada cliente.
      </p>

      <section className="mt-8 rounded-2xl border border-surface/70 p-5">
        <h2 className="mb-4 text-sm font-medium">Nuevo cliente</h2>
        <ClientForm />
      </section>

      <div className="mt-8 flex flex-col gap-6">
        {clients.map((c) => (
          <details key={c.id} className="group rounded-2xl border border-surface/70">
            <summary className="flex cursor-pointer list-none items-center gap-3 p-5 [&::-webkit-details-marker]:hidden">
              <ChevronRight
                size={16}
                className="shrink-0 text-foreground/50 transition-transform group-open:rotate-90"
              />
              <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</h2>
              {c.last_sync_error && <span className="shrink-0 text-xs text-red-400">Error de sync</span>}
              <p className="hidden shrink-0 text-xs text-foreground/50 sm:block">
                {c.last_synced_at ? `Sync: ${formatDateTime(c.last_synced_at)}` : "Nunca sincronizado"}
              </p>
            </summary>
            <div className="border-t border-surface/70 p-5">
              {c.last_sync_error && <p className="mb-4 text-sm text-red-400">Último error: {c.last_sync_error}</p>}
              <ClientForm client={c} />
              <div className="mt-6 border-t border-surface/70 pt-5">
                <SyncButton clientId={c.id} />
              </div>
              {c.trips_db_server && (
                <div className="mt-6 border-t border-surface/70 pt-5">
                  <TripsTestButton clientId={c.id} />
                </div>
              )}
              <div className="mt-6 border-t border-surface/70 pt-5">
                <UserForm clientId={c.id} />
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
