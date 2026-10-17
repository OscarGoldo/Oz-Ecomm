import { ArrowRight } from "lucide-react";

import {
  AVATAR,
  Avatar,
  SAMPLE,
  SectionHeading,
  bs,
  rateText,
  reveal,
  usd,
  wrap,
  sectionY,
} from "@/components/landing/landing-ui";
import { cn } from "@/lib/utils";

/**
 * "Así vendes hoy. Así podrías vender." — el antes y después del carrusel de
 * Instagram, en grande. Se habla del problema antes que del producto: la
 * bandeja llena de «¿precio?» es lo que el comerciante vive todos los días.
 *
 * Las personas y los pedidos son de ejemplo y se ven como interfaz, no como
 * testimonio: no se inventan clientes ni cifras de ventas.
 */
const INBOX = [
  { who: "andrea.ccs", msg: "¿precio?", time: "ahora", color: AVATAR.azul, unread: true },
  { who: "luis.p_", msg: "¿precio porfa?", time: "1 min", color: AVATAR.ambar, unread: true },
  { who: "carla.mrz", msg: "¿y en bolívares cuánto es?", time: "3 min", color: AVATAR.verde, unread: true },
  { who: "jose_rdz", msg: "te mandé el capture", time: "6 min", color: AVATAR.rosa, unread: false },
  { who: "mariale.v", msg: "¿precio?", time: "9 min", color: AVATAR.pizarra, unread: true },
  { who: "daniel.rr", msg: "¿te queda la M en negro?", time: "12 min", color: AVATAR.azul, unread: false },
];

const ORDERS = [
  {
    id: "#131",
    who: "Andrea R.",
    what: `${SAMPLE.franela.name} · M · Negro`,
    amount: SAMPLE.franela.usd,
    method: "Pago Móvil",
    status: "wait" as const,
  },
  {
    id: "#130",
    who: "Luis P.",
    what: `${SAMPLE.gorra.name} + ${SAMPLE.tote.name}`,
    amount: SAMPLE.gorra.usd + SAMPLE.tote.usd,
    method: "Zelle",
    status: "paid" as const,
  },
  {
    id: "#129",
    who: "Carla M.",
    what: SAMPLE.lentes.name,
    amount: SAMPLE.lentes.usd,
    method: "Binance",
    status: "sent" as const,
  },
];

const STATUS = {
  wait: { label: "Por confirmar", className: "bg-warning-surface text-warning-text" },
  paid: { label: "Pagado", className: "bg-success-surface text-success-text" },
  sent: { label: "Enviado", className: "bg-info-surface text-info-text" },
};

const card = "relative min-w-0 rounded-[26px] border border-linea bg-white px-[22px] pb-6 pt-[22px]";
const chip = "rounded-full px-[11px] py-2 font-landing-mono text-[11.5px] font-semibold uppercase leading-none tracking-[0.08em]";

export function BeforeAfter({ usdRate }: { usdRate: number | null }) {
  const franela = SAMPLE.franela.usd;

  return (
    <section id="antes" className={cn(sectionY, "scroll-mt-20")}>
      <div className={wrap}>
        <SectionHeading
          eyebrow="Antes y después"
          title="Así vendes hoy. Así podrías vender."
          text="Lo mismo que ya haces por Instagram y WhatsApp, sin contestar el mismo mensaje cincuenta veces al día."
        />

        <div className="mt-[60px] grid items-center gap-7 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.15fr)]">
          {/* Hoy */}
          {/* Los mensajes van llegando uno por uno a la bandeja, y del otro
              lado los pedidos se ordenan solos: la historia se cuenta al bajar. */}
          <article
            {...reveal()}
            className={cn(card, "shadow-[0_1px_2px_hsl(var(--noche)/0.05),0_6px_16px_-6px_hsl(var(--noche)/0.1)] lg:[rotate:-1.2deg]")}
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className={cn(chip, "bg-claro-hondo text-pizarra")}>Hoy</span>
              <span className="text-[13.5px] font-semibold text-gris">37 chats sin leer</span>
            </div>
            <ul>
              {INBOX.map((m, i) => (
                <li
                  key={m.who}
                  {...reveal(250 + i * 110)}
                  className="grid grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 border-t border-linea px-0.5 py-2.5"
                >
                  <Avatar initial={m.who.charAt(0).toUpperCase()} color={m.color} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight">{m.who}</p>
                    <p className={cn("truncate text-[15px] leading-snug", m.unread && "font-bold")}>
                      {m.msg}
                    </p>
                  </div>
                  <span className="flex items-center gap-2 font-landing-mono text-xs text-gris">
                    {m.time}
                    {m.unread && (
                      <span className="size-2 rounded-full bg-brand-500">
                        <span className="sr-only">sin leer</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 max-w-[30ch] text-[14.5px] text-pizarra">
              Sacas la cuenta en bolívares a mano y buscas cada capture en la galería.
            </p>
            {usdRate && (
              <div
                {...reveal(950, "pop")}
                className="mt-4 max-w-[230px] rounded bg-sol px-[15px] py-3 font-landing-mono text-[13px] leading-normal text-noche shadow-[0_28px_56px_-22px_hsl(var(--noche)/0.32)] [rotate:-1.5deg] sm:absolute sm:-bottom-[34px] sm:right-3 sm:mt-0 sm:[rotate:4deg] lg:-right-4">
                {franela} × {rateText(usdRate)} =
                <b className="block text-[15px] font-semibold">{bs(franela, usdRate).replace("Bs ", "")} Bs</b>
                ¿y si mañana cambia la tasa?
              </div>
            )}
          </article>

          <div
            aria-hidden="true"
            {...reveal(200, "pop")}
            className="grid size-[58px] place-items-center justify-self-center rounded-full bg-noche text-white max-lg:rotate-90"
          >
            <ArrowRight className="size-6" />
          </div>

          {/* Con Tiendify */}
          <article
            {...reveal(300)}
            className={cn(card, "shadow-[0_2px_4px_hsl(var(--noche)/0.06),0_28px_56px_-22px_hsl(var(--noche)/0.32)]")}
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <span className={cn(chip, "bg-sol text-noche")}>Con Tiendify</span>
              <span className="text-[13.5px] font-semibold text-gris">Pedidos de hoy</span>
            </div>
            <ul>
              {ORDERS.map((o, i) => (
                <li
                  key={o.id}
                  {...reveal(500 + i * 140)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 border-t border-linea py-[13px]"
                >
                  <div className="min-w-0">
                    <p className="font-landing-mono text-xs font-semibold text-gris">{o.id}</p>
                    <p className="mt-0.5 font-bold leading-tight">{o.who}</p>
                    <p className="text-sm leading-snug text-pizarra">{o.what}</p>
                  </div>
                  <p className="text-right font-landing-mono text-[15px] font-semibold leading-tight tabular-nums">
                    {usd(o.amount)}
                    {usdRate && (
                      <small className="block text-[12.5px] font-medium text-gris">
                        {bs(o.amount, usdRate)}
                      </small>
                    )}
                  </p>
                  <div className="col-span-2 mt-1.5 flex flex-wrap items-center gap-2.5">
                    <span className={cn("rounded-full px-2.5 py-1.5 text-xs font-bold leading-none", STATUS[o.status].className)}>
                      {STATUS[o.status].label}
                    </span>
                    <span className="text-[13px] font-semibold text-pizarra">{o.method}</span>
                    {o.status === "wait" && (
                      <span className="ml-auto text-[13.5px] font-bold text-brand-700">Ver capture</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div
              {...reveal(950, "pop")}
              className="mt-1.5 flex flex-wrap items-center gap-3 rounded-2xl bg-claro-hondo px-3.5 py-3"
            >
              <Avatar initial="J" color={AVATAR.rosa} className="size-8 text-xs" />
              <p className="min-w-[180px] flex-1 text-sm leading-snug">
                <b>José R.</b> dejó 2 productos en el carrito
              </p>
              <span className="inline-flex min-h-[34px] items-center whitespace-nowrap rounded-full bg-noche px-3 text-[13px] font-bold text-white">
                Escribirle por WhatsApp
              </span>
            </div>
            <p className="mt-4 max-w-[44ch] text-[14.5px] text-pizarra">
              Cada pedido llega con su monto en las dos monedas y su comprobante. Tú solo confirmas.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
