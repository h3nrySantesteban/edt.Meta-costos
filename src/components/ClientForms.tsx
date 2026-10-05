"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { createClientUser, saveClient, syncNow, type FormState } from "@/app/actions";
import type { ClientInfo } from "@/lib/costs";

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p className="text-sm text-red-400">{state.error}</p>;
  if (state?.ok) return <p className="text-sm text-emerald-400">{state.ok}</p>;
  return null;
}

function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function ClientForm({ client }: { client?: ClientInfo }) {
  const [state, action, pending] = useActionState(saveClient, undefined);
  return (
    <form action={action} autoComplete="off" className="grid gap-4 sm:grid-cols-2">
      {client && <input type="hidden" name="id" value={client.id} />}
      <div>
        <label className="mb-1.5 block text-sm text-foreground/70">Nombre</label>
        <input name="name" required autoComplete="off" defaultValue={client?.name} className="input" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-foreground/70">WABA ID</label>
        <input
          name="waba_id"
          inputMode="numeric"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          defaultValue={client?.waba_id ?? ""}
          className="input font-mono"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm text-foreground/70">
          Token de System User {client?.has_token && <span className="text-foreground/40">(guardado — dejar vacío para conservar)</span>}
        </label>
        <input
          name="token"
          type="password"
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          className="input font-mono"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-foreground/70">
        <input type="checkbox" name="active" defaultChecked={client?.active ?? true} />
        Activo
      </label>
      <div className="flex items-center justify-end gap-4 sm:col-span-2">
        <Msg state={state} />
        <Submit pending={pending}>{client ? "Guardar" : "Crear cliente"}</Submit>
      </div>
    </form>
  );
}

export function UserForm({ clientId }: { clientId: number }) {
  const [state, action, pending] = useActionState(createClientUser, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="client_id" value={clientId} />
      <div>
        <label className="mb-1.5 block text-sm text-foreground/70">Email del usuario</label>
        <input name="email" type="email" required autoComplete="off" className="input" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-foreground/70">Contraseña</label>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
      </div>
      <Submit pending={pending}>Crear usuario</Submit>
      <div className="sm:col-span-3">
        <Msg state={state} />
      </div>
    </form>
  );
}

export function SyncButton({ clientId }: { clientId: number }) {
  const [pending, start] = useTransition();
  const [days, setDays] = useState(7);
  const [state, setState] = useState<FormState>();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="input !w-auto !py-2"
        aria-label="Rango a sincronizar"
      >
        {[7, 30, 90, 365].map((d) => (
          <option key={d} value={d} className="bg-background">
            Últimos {d} días
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await syncNow(clientId, days)))}
        className="flex h-10 items-center gap-2 rounded-full border border-surface px-4 text-sm transition-colors hover:bg-surface disabled:opacity-60"
      >
        <RefreshCw size={15} className={pending ? "animate-spin" : ""} />
        Sincronizar ahora
      </button>
      <Msg state={state} />
    </div>
  );
}
