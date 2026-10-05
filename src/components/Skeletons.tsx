function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface/60 ${className}`} />;
}

/** Marcador de posición del contenido de datos (tarjetas, gráfico y filas). */
export function ContentSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-hidden>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-surface/70 p-5">
            <Bar className="h-4 w-4" />
            <Bar className="mt-5 h-8 w-32" />
            <Bar className="mt-3 h-3.5 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-8 rounded-2xl border border-surface/70 p-5">
        <Bar className="mb-5 h-3.5 w-24" />
        <Bar className="h-40 w-full" />
      </div>
      <div className="mt-8 flex flex-col divide-y divide-surface/70 border-y border-surface/70">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3.5">
            <Bar className="h-4 flex-1" />
            <Bar className="h-4 w-16" />
            <Bar className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Esqueleto de página completa (título + filtros + datos). */
export function PageSkeleton() {
  return (
    <div aria-hidden>
      <Bar className="h-7 w-40" />
      <Bar className="mt-3 h-4 w-72 max-w-full" />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Bar key={i} className="h-8 w-20 !rounded-full" />
        ))}
      </div>
      <ContentSkeleton />
    </div>
  );
}
