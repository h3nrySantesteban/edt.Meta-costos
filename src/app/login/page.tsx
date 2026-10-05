"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!state?.retryAfter) return;
    const deadline = Date.now() + state.retryAfter * 1000;
    const tick = () => {
      const left = Math.max(Math.ceil((deadline - Date.now()) / 1000), 0);
      setSecondsLeft(left);
      if (left === 0) clearInterval(id);
    };
    const id = setInterval(tick, 500);
    const first = setTimeout(tick, 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, [state]);

  const locked = !!state?.retryAfter && secondsLeft > 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-surface bg-surface/40">
            <Lock size={18} />
          </div>
          <h1 className="text-xl font-medium">Costos de WhatsApp</h1>
          <p className="mt-1 text-sm text-foreground/50">Ingresá tus credenciales para continuar.</p>
        </div>

        <form action={action} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-foreground/70">
              Usuario (email)
            </label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input" />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-foreground/70">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>

          {state?.error && <p className="text-sm text-red-400">{state.error}</p>}

          <button
            type="submit"
            disabled={pending || locked}
            className="mt-2 flex h-11 items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 size={15} className="animate-spin" />}
            {locked ? `Reintentar en ${mm}:${ss}` : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
