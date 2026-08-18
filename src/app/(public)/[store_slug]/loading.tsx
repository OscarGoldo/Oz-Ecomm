/**
 * Esqueleto de la home de la tienda.
 *
 * Antes dibujaba un avatar redondo montado sobre un banner —una composición
 * tipo perfil que ninguna plantilla renderiza— así que al llegar el contenido
 * real todo saltaba de lugar. Ahora sigue la estructura de verdad: hero, franja
 * de beneficios, chips de categoría y grilla.
 */
export default function StorefrontLoading() {
  return (
    <main className="animate-pulse pb-4">
      {/* Hero */}
      <div className="h-44 w-full bg-muted sm:h-64" />

      {/* Franja de beneficios */}
      <div className="border-b bg-card">
        <div className="container grid grid-cols-2 gap-3 py-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="size-9 shrink-0 rounded-lg bg-muted" />
              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                <div className="h-3 w-20 rounded bg-muted" />
                <div className="h-2.5 w-28 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Catálogo */}
      <div className="container space-y-4 pt-6">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 shrink-0 rounded-full bg-muted" />
          ))}
        </div>
        <div className="h-6 w-44 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg border bg-card">
              <div className="aspect-square bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-11 w-full rounded-lg bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
