"use client";

import { useTransition } from "react";
import { selectClient } from "@/app/actions";

export function ClientSelect({
  clients,
  activeId,
}: {
  clients: { id: number; name: string }[];
  activeId: number | null;
}) {
  const [pending, start] = useTransition();

  return (
    <div>
      <label htmlFor="client" className="mb-1.5 block px-0.5 text-xs text-foreground/50">
        Cliente
      </label>
      <select
        id="client"
        value={activeId ?? ""}
        disabled={pending || clients.length === 0}
        onChange={(e) => start(() => selectClient(Number(e.target.value)))}
        className="input !py-2 disabled:opacity-60"
      >
        <option value="" disabled className="bg-background">
          {clients.length ? "Seleccionar…" : "Sin clientes"}
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id} className="bg-background">
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
