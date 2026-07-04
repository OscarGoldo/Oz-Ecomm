import { ShoppingBag } from "lucide-react";

/** Fictional clothing products rendered with pure-CSS color blocks (no images). */
const PRODUCTS = [
  { name: "Camiseta Oversize", price: "$18", garment: "from-stone-200 to-stone-400" },
  { name: "Jean Mom", price: "$32", garment: "from-sky-300 to-blue-500" },
  { name: "Sudadera Hoodie", price: "$40", garment: "from-rose-300 to-rose-500" },
  { name: "Chaqueta Denim", price: "$55", garment: "from-indigo-400 to-indigo-600" },
];

/**
 * Pure-CSS smartphone mockup showing a fictional clothing store ("URBAN
 * THREADS") to preview what a store built with OzShop looks like.
 */
export function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[270px] animate-float [animation-duration:7s] sm:w-[290px]">
      {/* Soft glow behind the phone */}
      <div className="absolute inset-0 -z-10 scale-90 rounded-[3rem] bg-primary/20 blur-3xl" />

      {/* Phone frame */}
      <div className="relative rounded-[2.75rem] bg-neutral-900 p-2.5 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.35)] ring-1 ring-black/10">
        {/* Side buttons */}
        <span className="absolute -left-0.5 top-28 h-14 w-0.5 rounded-l bg-neutral-800" />
        <span className="absolute -right-0.5 top-24 h-9 w-0.5 rounded-r bg-neutral-800" />

        {/* Screen */}
        <div className="relative h-[560px] overflow-hidden rounded-[2.25rem] bg-white">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />

          <div className="flex h-full flex-col">
            {/* Store header */}
            <div className="flex items-center justify-between px-4 pb-2.5 pt-9">
              <span className="text-sm font-extrabold uppercase tracking-tight">
                Urban Threads
              </span>
              <span className="relative">
                <ShoppingBag className="size-5 text-neutral-800" />
                <span className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-primary text-[8px] font-bold text-white">
                  2
                </span>
              </span>
            </div>

            {/* Banner */}
            <div className="mx-3 overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 p-4 text-white">
              <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-white/60">
                Nueva colección
              </p>
              <p className="mt-1 text-base font-extrabold uppercase leading-tight">
                Urbano
                <br />
                sin límites
              </p>
              <span className="mt-2 inline-block rounded-full bg-white px-2.5 py-1 text-[9px] font-bold text-neutral-900">
                Hasta 30% OFF
              </span>
            </div>

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-2.5 p-3">
              {PRODUCTS.map((p, i) => (
                <div
                  key={p.name}
                  className="animate-fade-in-up overflow-hidden rounded-xl border border-neutral-200 bg-white"
                  style={{ animationDelay: `${0.15 + i * 0.12}s` }}
                >
                  <div className={`relative aspect-[4/5] bg-gradient-to-br ${p.garment}`}>
                    {i % 2 === 0 && (
                      <span className="absolute left-1.5 top-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-neutral-800">
                        New
                      </span>
                    )}
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="truncate text-[10px] font-semibold text-neutral-800">
                      {p.name}
                    </p>
                    <p className="text-[11px] font-extrabold text-neutral-900">
                      {p.price}
                    </p>
                    <div className="grid h-6 place-items-center rounded-md bg-neutral-900 text-[9px] font-bold text-white">
                      Agregar
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom bar hint */}
            <div className="mt-auto flex items-center justify-center pb-3">
              <span className="h-1 w-24 rounded-full bg-neutral-200" />
            </div>
          </div>
        </div>
      </div>

      {/* Floating "new order" badge */}
      <div className="absolute -right-4 top-10 rotate-6 rounded-2xl bg-success px-3 py-2 text-xs font-bold text-success-foreground shadow-xl">
        ¡Nueva venta! 🎉
      </div>
    </div>
  );
}
