import { FREE_MAX_PRODUCTS } from "@/lib/plans";
import { rateText, wrap } from "@/components/landing/landing-ui";

/**
 * La cinta de arriba con la tasa del BCV. Es el dato que el comerciante mira
 * todos los días, y verlo en la primera línea de la página dice "esto está
 * hecho para aquí" antes que cualquier titular.
 *
 * No dice "de hoy": la landing solo tiene la tasa cacheada, no su fecha, y un
 * fin de semana o un cron caído la dejarían anunciando como de hoy una tasa
 * vieja (ver lib/exchange-rate.ts). Sin tasa, se cuenta la función sin cifra.
 */
export function RateTicker({ usdRate }: { usdRate: number | null }) {
  return (
    <div className="bg-noche text-[13.5px] text-claro">
      <div className={`${wrap} flex items-center justify-between gap-4 py-[9px]`}>
        <p>
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-[7px] rounded-full bg-emerald-400 align-[1px] shadow-[0_0_0_3px_rgb(52_211_153/0.25)]"
          />
          {usdRate ? (
            <>
              Tasa BCV:{" "}
              <b className="font-landing-mono font-semibold tabular-nums">
                {rateText(usdRate)} Bs/$
              </b>
              <span className="hidden text-niebla md:inline">
                {" "}
                · Tu tienda la aplica sola cada mañana
              </span>
            </>
          ) : (
            "Precios en dólares y bolívares, con la tasa del BCV de cada mañana"
          )}
        </p>
        <p className="hidden text-niebla md:block">
          Gratis hasta {FREE_MAX_PRODUCTS} productos · Sin tarjeta
        </p>
      </div>
    </div>
  );
}

/** Lo que de verdad diferencia a Tiendify de un Shopify: cómo se cobra acá. */
const PAYMENTS = [
  "Pago Móvil",
  "Zelle",
  "Binance",
  "Transferencia",
  "Efectivo",
  "Tarjeta",
  "Apple Pay",
  "Google Pay",
];

/**
 * Los métodos de pago, en texto y no en logos: son los nombres que el
 * comerciante busca para saber si esto le sirve. Corren en una cinta; la
 * segunda vuelta es solo para que el bucle no tenga corte y los lectores de
 * pantalla la saltan.
 */
export function PayStrip() {
  return (
    <div className="bg-noche text-claro">
      <div
        className={`${wrap} flex items-center gap-7 py-5 max-sm:flex-col max-sm:items-start max-sm:gap-3`}
      >
        <p className="shrink-0 font-landing-mono text-xs font-semibold uppercase leading-snug tracking-[0.08em] text-niebla">
          Cobras con
        </p>
        <div className="min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)] max-sm:w-full motion-reduce:[mask-image:none]">
          {/* Con "reducir movimiento" no corre: queda una lista que se parte en
              renglones, sin la segunda vuelta. */}
          <div className="flex w-max motion-safe:animate-marquee-slow motion-reduce:w-auto">
            {[0, 1].map((pass) => (
              <ul
                key={pass}
                aria-hidden={pass === 1 || undefined}
                className={
                  pass === 1
                    ? "flex motion-reduce:hidden"
                    : "flex motion-reduce:flex-wrap motion-reduce:gap-y-3"
                }
              >
                {PAYMENTS.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-[26px] whitespace-nowrap pr-[26px] font-landing-display text-[clamp(19px,1.6vw,24px)] font-bold leading-none tracking-[-0.02em] [font-stretch:90%] after:size-[9px] after:rounded-full after:bg-brand-500 after:content-['']"
                  >
                    {p}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
