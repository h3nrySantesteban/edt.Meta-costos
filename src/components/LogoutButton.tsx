import { LogOut } from "lucide-react";
import { logout } from "@/app/actions";

export function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex items-center gap-2 text-sm text-foreground/60 transition-colors hover:text-foreground"
      >
        <LogOut size={15} />
        Cerrar sesión
      </button>
    </form>
  );
}
