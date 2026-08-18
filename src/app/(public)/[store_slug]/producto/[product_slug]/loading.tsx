/** Esqueleto de la ficha de producto: galería + datos, no la grilla del catálogo. */
export default function ProductLoading() {
  return (
    <main className="container animate-pulse py-6">
      <div className="mb-4 h-4 w-32 rounded bg-muted" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="aspect-square w-full rounded-xl bg-muted" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="size-16 shrink-0 rounded-lg bg-muted" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-7 w-3/4 rounded bg-muted" />
            <div className="h-8 w-28 rounded bg-muted" />
          </div>
          <div className="h-6 w-24 rounded-full bg-muted" />
          <div className="h-12 w-full rounded-lg bg-muted" />
          <div className="h-12 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </main>
  );
}
