"use client";

import { useActionState, useState, useTransition } from "react";
import { Database, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { createClientUser, deleteClientUser, resetUserPassword, saveClient, syncNow, testTripsDb, type FormState } from "@/app/actions";
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
      <fieldset className="grid gap-4 border-t border-surface/70 pt-5 sm:col-span-2 sm:grid-cols-[1fr_8rem]">
        <legend className="mb-3 text-sm font-medium">
          Base de datos de viajes <span className="font-normal text-foreground/40">(opcional)</span>
        </legend>
        <div>
          <label className="mb-1.5 block text-sm text-foreground/70">Servidor</label>
          <input
            name="trips_server"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            defaultValue={client?.trips_db_server ?? ""}
            className="input font-mono"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-foreground/70">Puerto</label>
          <input
            name="trips_port"
            inputMode="numeric"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            defaultValue={client?.trips_db_port ?? 1433}
            className="input font-mono"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-foreground/70">Base de datos</label>
          <input
            name="trips_db"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            defaultValue={client?.trips_db_name ?? ""}
            className="input font-mono"
          />
        </div>
        <div className="sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-4">
          <div>
            <label className="mb-1.5 block text-sm text-foreground/70">Usuario</label>
            <input
              name="trips_user"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              defaultValue={client?.trips_db_user ?? ""}
              className="input font-mono"
            />
          </div>
          <div className="mt-4 sm:mt-0">
            <label className="mb-1.5 block text-sm text-foreground/70">
              Contraseña{" "}
              {client?.has_trips_password && <span className="text-foreground/40">(guardada — vacío para conservar)</span>}
            </label>
            <input
              name="trips_password"
              type="password"
              autoComplete="new-password"
              data-1p-ignore
              data-lpignore="true"
              className="input font-mono"
            />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm text-foreground/70">
            Números de usuario telefonista <span className="text-foreground/40">(nro_usuario_telefonista, separados por coma)</span>
          </label>
          <input
            name="trips_users"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            placeholder="9897, 9898, 9899"
            defaultValue={client?.trips_users ?? ""}
            className="input font-mono"
          />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" name="trips_encrypt" defaultChecked={client?.trips_db_encrypt ?? true} />
            Conexión cifrada (TLS)
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" name="trips_trust" defaultChecked={client?.trips_db_trust_cert ?? true} />
            Confiar en el certificado del servidor
          </label>
        </div>
      </fieldset>
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

function UserRow({ user }: { user: { id: number; email: string; password: string | null } }) {
  const [state, action, pending] = useActionState(resetUserPassword, undefined);
  return (
    <li className="py-3.5">
      <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <p className="min-w-0 break-all">
          <span className="text-foreground/50">Usuario: </span>
          <span className="font-mono select-all">{user.email}</span>
        </p>
        <p className="min-w-0 break-all">
          <span className="text-foreground/50">Contraseña: </span>
          {user.password ? (
            <span className="font-mono select-all">{user.password}</span>
          ) : (
            <span className="text-foreground/40">no disponible — definí una nueva</span>
          )}
        </p>
      </div>
      <form action={action} autoComplete="off" className="mt-2.5 flex flex-wrap items-center gap-3">
        <input type="hidden" name="user_id" value={user.id} />
        <input
          name="password"
          required
          minLength={8}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          placeholder="Nueva contraseña"
          className="input !w-56 !py-1.5 font-mono"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-8 rounded-full border border-surface px-3.5 text-xs transition-colors hover:bg-surface disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Cambiar contraseña"}
        </button>
        <Msg state={state} />
        <DeleteUserButton userId={user.id} email={user.email} />
      </form>
    </li>
  );
}

function DeleteUserButton({ userId, email }: { userId: number; email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="ml-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-red-400 transition-colors hover:bg-red-400/10"
      >
        <Trash2 size={13} />
        Eliminar
      </button>
    );
  }

  return (
    <span className="ml-auto flex flex-wrap items-center gap-2 text-xs">
      <span className="text-foreground/60">¿Eliminar a {email}?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await deleteClientUser(userId);
            setState(r);
            if (r?.error) setConfirming(false);
          })
        }
        className="flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && <Loader2 size={13} className="animate-spin" />}
        Sí, eliminar
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="h-8 rounded-full border border-surface px-3 transition-colors hover:bg-surface disabled:opacity-60"
      >
        Cancelar
      </button>
      {state?.error && <span className="text-red-400">{state.error}</span>}
    </span>
  );
}

export function UserList({ users }: { users: { id: number; email: string; password: string | null }[] }) {
  if (users.length === 0) return <p className="mb-5 text-sm text-foreground/50">Este cliente todavía no tiene usuarios.</p>;
  return (
    <ul className="mb-5 divide-y divide-surface/70 border-y border-surface/70">
      {users.map((u) => (
        <UserRow key={u.id} user={u} />
      ))}
    </ul>
  );
}

export function UserForm({ clientId }: { clientId: number }) {
  const [state, action, pending] = useActionState(createClientUser, undefined);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <input type="hidden" name="client_id" value={clientId} />
      <div>
        <label className="mb-1.5 block text-sm text-foreground/70">Usuario</label>
        <input name="email" type="text" required autoComplete="off" autoCapitalize="none" spellCheck={false} className="input" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm text-foreground/70">Contraseña</label>
        <input
          name="password"
          required
          minLength={8}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          className="input font-mono"
        />
      </div>
      <Submit pending={pending}>Crear usuario</Submit>
      <div className="sm:col-span-3">
        <Msg state={state} />
      </div>
    </form>
  );
}

export function TripsTestButton({ clientId }: { clientId: number }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await testTripsDb(clientId)))}
        className="flex h-10 items-center gap-2 rounded-full border border-surface px-4 text-sm transition-colors hover:bg-surface disabled:opacity-60"
      >
        <Database size={15} className={pending ? "animate-pulse" : ""} />
        Probar base de viajes
      </button>
      <Msg state={state} />
    </div>
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
