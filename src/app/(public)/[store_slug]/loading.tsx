export default function StorefrontLoading() {
  return (
    <main className="animate-pulse">
      <div className="h-24 w-full bg-muted sm:h-32" />
      <div className="container -mt-8 sm:-mt-10">
        <div className="flex items-end gap-4">
          <div className="size-20 shrink-0 rounded-2xl border-4 border-background bg-muted" />
          <div className="space-y-2 pb-1">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-3 w-56 rounded bg-muted" />
          </div>
        </div>
        <div className="mt-6 h-11 w-full rounded-md bg-muted" />
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border bg-card">
              <div className="aspect-square bg-muted" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
