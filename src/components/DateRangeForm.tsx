"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useNavigation } from "@/components/Navigation";

export function DateRangeForm({
  basePath,
  from,
  to,
  extra = {},
}: {
  basePath: string;
  from: string;
  to: string;
  extra?: Record<string, string>;
}) {
  const { pending, target, navigate } = useNavigation();
  const [url, setUrl] = useState<string | null>(null);
  const loading = pending && target === url;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qs = new URLSearchParams({
      ...extra,
      from: String(fd.get("from") ?? ""),
      to: String(fd.get("to") ?? ""),
    });
    const next = `${basePath}?${qs}`;
    setUrl(next);
    navigate(next);
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input type="date" name="from" defaultValue={from} className="input !w-auto !py-1.5" />
      <span className="text-foreground/40">→</span>
      <input type="date" name="to" defaultValue={to} className="input !w-auto !py-1.5" />
      <button
        type="submit"
        disabled={loading}
        className="flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-70"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Aplicar
      </button>
    </form>
  );
}
