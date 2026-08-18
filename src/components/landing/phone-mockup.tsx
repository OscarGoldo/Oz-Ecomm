import { ShoppingBag } from "lucide-react";

/**
 * Vista previa de una tienda hecha con Tiendify.
 *
 * Dos decisiones sobre qué muestra:
 *
 *  1. La tienda se llama "Tu tienda", no una marca inventada. Antes decía
 *     "Urban Threads" con una colección ficticia, y eso se leía como relleno:
 *     el que llega no sabe si está viendo un cliente real o un dibujo. Con
 *     "Tu tienda" queda claro que es la plantilla y el mensaje es directo.
 *
 *  2. Los precios salen en dólares Y en bolívares, con la tasa BCV real del
 *     día que le pasa la landing. La doble moneda es la razón principal por la
 *     que un comerciante venezolano elige esto en vez de un Shopify, así que
 *     tiene que estar en la primera imagen que ve — y calculada de verdad, no
 *     escrita a mano.
 */
const PRODUCTS = [
  { name: "Audífonos inalámbricos", usd: 24, tone: "from-slate-200 to-slate-400" },
  { name: "Cafetera 12 tazas", usd: 38, tone: "from-stone-300 to-stone-500" },
  { name: "Licuadora 3 velocidades", usd: 45, tone: "from-sky-200 to-sky-400" },
  { name: "Plancha a vapor", usd: 29, tone: "from-rose-200 to-rose-400" },
];

/** Bs redondeado a entero: en una pantalla de 270 px los céntimos estorban. */
function bsShort(usd: number, rate: number): string {
  return `Bs ${new Intl.NumberFormat("es-VE", {
    maximumFractionDigits: 0,
  }).format(usd * rate)}`;
}

export function PhoneMockup({ bcvRate }: { bcvRate?: number | null }) {
  const rate = bcvRate && bcvRate > 0 ? bcvRate : null;
  const total = PRODUCTS[0]!.usd + PRODUCTS[2]!.usd;

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
        {/* 590 y no 560: la tasa del día y la franja de pagos necesitan ese
            alto. Con 290 de ancho queda en ~21:10, la proporción de un
            teléfono actual. */}
        <div className="relative h-[590px] overflow-hidden rounded-[2.25rem] bg-white">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-20 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />

          <div className="flex h-full flex-col">
            {/* Store header */}
            <div className="flex items-center justify-between px-4 pb-2.5 pt-9">
              <span className="text-sm font-extrabold tracking-tight text-neutral-900">
                Tu tienda
              </span>
              <span className="relative">
                <ShoppingBag className="size-5 text-neutral-800" />
                <span className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-primary text-[8px] font-bold text-white">
                  2
                </span>
              </span>
            </div>

            {/* Tasa del día: el dato que el comerciante actualiza y el cliente mira */}
            {rate && (
              <div className="mx-3 flex items-center justify-between rounded-xl bg-neutral-100 px-3 py-2">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                  Tasa de hoy
                </span>
                <span className="text-[10px] font-bold text-neutral-900">
                  {new Intl.NumberFormat("es-VE", {
                    maximumFractionDigits: 2,
                  }).format(rate)}{" "}
                  Bs/$
                </span>
              </div>
            )}

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-2.5 p-3">
              {PRODUCTS.map((p, i) => (
                <div
                  key={p.name}
                  className="animate-fade-in-up overflow-hidden rounded-xl border border-neutral-200 bg-white"
                  style={{ animationDelay: `${0.15 + i * 0.12}s` }}
                >
                  {/* Cuadrada y no 4:5: la línea de bolívares y la franja de
                      pagos suman alto, y con 4:5 la pantalla desbordaba. */}
                  <div className={`relative aspect-square bg-gradient-to-br ${p.tone}`} />
                  <div className="space-y-0.5 p-2">
                    <p className="truncate text-[10px] font-semibold leading-tight text-neutral-800">
                      {p.name}
                    </p>
                    <p className="text-[11px] font-extrabold leading-tight text-neutral-900">
                      ${p.usd}
                    </p>
                    {rate && (
                      <p className="text-[9px] font-medium leading-tight text-neutral-500">
                        {bsShort(p.usd, rate)}
                      </p>
                    )}
                    <div className="mt-1 grid h-6 place-items-center rounded-md bg-neutral-900 text-[9px] font-bold text-white">
                      Agregar
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cómo paga el cliente: la otra mitad del argumento */}
            <div className="mt-auto border-t border-neutral-100 px-3 pb-3 pt-2.5">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-neutral-400">
                Métodos de pago
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {["Pago Móvil", "Zelle", "Binance", "Efectivo"].map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-neutral-100 px-2 py-0.5 text-[8px] font-semibold text-neutral-600"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de pedido: un pedido concreto dice más que "¡Nueva venta!" */}
      <div className="absolute -right-3 top-10 rounded-2xl border border-black/5 bg-white px-3 py-2 shadow-xl">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Nuevo pedido
        </p>
        <p className="text-xs font-bold text-foreground">
          #128 · ${total},00
        </p>
        {rate && (
          <p className="text-[9px] font-medium text-muted-foreground">
            {bsShort(total, rate)}
          </p>
        )}
      </div>
    </div>
  );
}
