import Image from "next/image";
import { BarChart3, Building2, FileText, ListTree } from "lucide-react";
import { requireSession, getActiveClientId } from "@/lib/auth";
import { listClients } from "@/lib/costs";
import { LogoutButton } from "@/components/LogoutButton";
import { ClientSelect } from "@/components/ClientSelect";
import { ContentArea, NavLink, NavigationProvider, SidebarLink, TopBar } from "@/components/Navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const isAdmin = session.role === "admin";
  const clients = isAdmin ? await listClients() : [];
  const activeId = await getActiveClientId(session);

  const nav = [
    { href: "/", label: "Resumen", icon: <BarChart3 size={15} /> },
    { href: "/detalle", label: "Detalle", icon: <ListTree size={15} /> },
    { href: "/facturas", label: "Facturas", icon: <FileText size={15} /> },
    ...(isAdmin ? [{ href: "/clientes", label: "Clientes", icon: <Building2 size={15} /> }] : []),
  ];

  return (
    <NavigationProvider>
      <TopBar />
      <div className="flex min-h-screen flex-1 flex-col md:flex-row">
        <aside className="scrollbar-none flex shrink-0 flex-col justify-between overflow-y-auto border-b border-surface/70 px-4 py-4 md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r md:px-5 md:py-6">
          <div>
            <NavLink href="/" className="block px-2">
              <Image src="/logo.svg" alt="Logo" width={184} height={50} priority unoptimized className="h-auto w-32" />
            </NavLink>
            <p className="mt-4 px-2 text-sm font-medium">{isAdmin ? "Admin" : "Mi cuenta"}</p>
            {isAdmin && (
              <div className="mt-4">
                <ClientSelect clients={clients.map((c) => ({ id: c.id, name: c.name }))} activeId={activeId} />
              </div>
            )}
            <nav className="mt-5 flex gap-1 overflow-x-auto scrollbar-none md:flex-col md:overflow-visible">
              {nav.map(({ href, label, icon }) => (
                <SidebarLink key={href} href={href} label={label} icon={icon} />
              ))}
            </nav>
          </div>

          <div className="mt-6 hidden flex-col gap-3 md:flex">
            <p className="truncate px-0.5 text-xs text-foreground/40">{session.email}</p>
            <LogoutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 md:px-10 md:py-10">
          <ContentArea>{children}</ContentArea>
        </main>
      </div>
    </NavigationProvider>
  );
}
