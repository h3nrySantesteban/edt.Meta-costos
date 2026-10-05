"use client";

import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { login } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

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
          <Image src="/logo.svg" alt="Logo" width={184} height={50} priority unoptimized className="mb-6 h-auto w-44" />
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
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="input pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-foreground/50 transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
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
