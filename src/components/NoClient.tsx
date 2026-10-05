import { Building2 } from "lucide-react";

export function NoClient({ admin }: { admin: boolean }) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-2xl border border-surface/70 px-6 py-14 text-center">
      <Building2 size={22} className="text-foreground/40" />
      <p className="mt-3 text-sm font-medium">
        {admin ? "Seleccioná un cliente" : "Tu cuenta no tiene un cliente asociado"}
      </p>
      <p className="mt-1 text-sm text-foreground/50">
        {admin
          ? "Usá el selector del menú lateral para ver su facturación."
          : "Contactá al administrador."}
      </p>
    </div>
  );
}
