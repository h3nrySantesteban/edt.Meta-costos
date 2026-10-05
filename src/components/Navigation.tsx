"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Ctx = { pending: boolean; target: string | null; navigate: (href: string) => void };

const NavContext = createContext<Ctx>({ pending: false, target: null, navigate: () => {} });

export const useNavigation = () => useContext(NavContext);

/** Centraliza las navegaciones para saber, al instante, cuándo hay una en curso y hacia dónde va. */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  function navigate(href: string) {
    setTarget(href);
    start(() => {
      router.push(href);
    });
  }

  return <NavContext value={{ pending, target: pending ? target : null, navigate }}>{children}</NavContext>;
}

/** Barra de progreso fina arriba de todo mientras carga una navegación. */
export function TopBar() {
  const { pending } = useNavigation();
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-150",
        pending ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="h-full w-1/3 animate-[progress_1.1s_ease-in-out_infinite] bg-foreground" />
    </div>
  );
}

/** Atenúa el contenido mientras se carga el nuevo. */
export function ContentArea({ children }: { children: ReactNode }) {
  const { pending } = useNavigation();
  return (
    <div aria-busy={pending} className={cn("transition-opacity duration-150", pending && "opacity-50")}>
      {children}
    </div>
  );
}

export function NavLink({
  href,
  className,
  active,
  children,
}: {
  href: string;
  className?: string;
  active?: boolean;
  children: ReactNode;
}) {
  const { pending, target, navigate } = useNavigation();
  const loading = pending && target === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(className, loading && "opacity-70")}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
      {loading && <Loader2 size={13} className="ml-auto shrink-0 animate-spin" />}
    </Link>
  );
}

export function SidebarLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const { pending, target } = useNavigation();
  const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
  // Mientras navega, resalta ya el destino.
  const active = pending && target ? target.split("?")[0] === href : current;

  return (
    <NavLink
      href={href}
      active={active}
      className={cn(
        "flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-surface hover:text-foreground",
        active ? "bg-surface text-foreground" : "text-foreground/70",
      )}
    >
      {icon}
      {label}
    </NavLink>
  );
}
