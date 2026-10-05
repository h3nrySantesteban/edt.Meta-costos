import { requireAdmin } from "@/lib/auth";
import { listClients } from "@/lib/costs";
import { ClientForm, SyncButton, UserForm } from "@/components/ClientForms";

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
          <section key={c.id} className="rounded-2xl border border-surface/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="truncate text-sm font-medium">{c.name}</h2>
              <p className="shrink-0 text-xs text-foreground/50">
                {c.last_synced_at ? `Sync: ${c.last_synced_at.toLocaleString("es")}` : "Nunca sincronizado"}
              </p>
            </div>
            {c.last_sync_error && <p className="mb-4 text-sm text-red-400">Último error: {c.last_sync_error}</p>}
            <ClientForm client={c} />
            <div className="mt-6 border-t border-surface/70 pt-5">
              <SyncButton clientId={c.id} />
            </div>
            <div className="mt-6 border-t border-surface/70 pt-5">
              <UserForm clientId={c.id} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
