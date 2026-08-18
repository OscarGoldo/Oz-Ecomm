/** Esqueleto del checkout. Antes mostraba la grilla del catálogo, que no tiene
 *  nada que ver con lo que viene y hacía saltar todo al llegar el contenido. */
export default function CheckoutLoading() {
  return (
    <main className="container max-w-5xl animate-pulse py-6">
      <div className="mb-4 h-4 w-36 rounded bg-muted" />
      <div className="mb-5 h-8 w-52 rounded bg-muted" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <div className="h-14 w-full rounded-xl bg-muted" />
          <div className="h-52 w-full rounded-xl bg-muted" />
          <div className="h-44 w-full rounded-xl bg-muted" />
          <div className="h-12 w-full rounded-lg bg-muted" />
        </div>
        <div className="h-40 w-full rounded-xl bg-muted lg:order-2" />
      </div>
    </main>
  );
}
