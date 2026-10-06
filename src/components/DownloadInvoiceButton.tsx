"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function DownloadInvoiceButton({ id, name }: { id: number; name: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}/download`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo descargar la factura.");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar la factura.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className="flex h-9 items-center gap-2 rounded-full border border-surface px-4 text-sm transition-colors hover:bg-surface disabled:opacity-60"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        Descargar
      </button>
      {error && <p className="max-w-xs text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
