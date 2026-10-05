import Link from "next/link";
import { BarChart3, Building2, ListTree } from "lucide-react";
import { requireSession, getActiveClientId } from "@/lib/auth";
import { listClients } from "@/lib/costs";
import { LogoutButton } from "@/components/LogoutButton";
import { ClientSelect } from "@/components/ClientSelect";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.role === "admin";
  const clients = isAdmin ? await listClients() : [];
  const activeId = await getActiveClientId(session);

  const nav = [
    { href: "/", label: "Resumen", icon: BarChart3 },
    { href: "/detalle", label: "Detalle", icon: ListTree },
    ...(isAdmin ? [{ href: "/clientes", label: "Clientes", icon: Building2 }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <aside className="scrollbar-none flex shrink-0 flex-col justify-between overflow-y-auto border-b border-surface/70 px-4 py-4 md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-5 md:py-6">
        <div>
          <p className="px-2 text-sm font-medium">{isAdmin ? "Admin" : "Mi cuenta"}</p>
          {isAdmin && (
            <div className="mt-4">
              <ClientSelect clients={clients.map((c) => ({ id: c.id, name: c.name }))} activeId={activeId} />
            </div>
          )}
          <nav className="mt-5 flex gap-1 overflow-x-auto scrollbar-none md:flex-col md:overflow-visible">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground/70 transition-colors hover:bg-surface hover:text-foreground"
              >
                <Icon size={15} />
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 hidden flex-col gap-3 md:flex">
          <p className="truncate px-0.5 text-xs text-foreground/40">{session.email}</p>
          <LogoutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
