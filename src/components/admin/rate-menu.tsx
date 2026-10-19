"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpDown, Check, ChevronDown, Copy, X } from "lucide-react";

import { landingFonts } from "@/components/landing/fonts";
import { bcvDateLabel, marginLabel } from "@/lib/exchange-rate";
import type { ExchangeRateSource } from "@/types/database";
import { evalAmount } from "@/lib/quick-calc";
import { cn } from "@/lib/utils";

/**
 * La tasa del día arriba del panel: una píldora con la moneda elegida que al
 * tocarla abre las tres tasas (dólar y euro del BCV, y el precio del USDT) y
 * una calculadora para las cuentas que el comerciante hace todo el día.
 *
 * Elegir moneda acá no cambia los precios de la tienda: eso sigue siendo la
 * tasa de Ajustes, y el pie del menú dice cuál es. Sin una elegida antes en
 * este navegador, arranca en la tasa con la que la tienda calcula sus Bs. En
 * escritorio se abre como un menú bajo la píldora; en el teléfono, como una
 * hoja desde abajo.
 */

export interface PanelRates {
  /** Bolívares por dólar y por euro del BCV. */
  usd: number | null;
  eur: number | null;
  /** Fecha valor del BCV: desde qué día rigen. */
  bcvDate: string | null;
  /** El precio del USDT (ver lib/usdt.ts). */
  usdt: { rate: number; source: "binance" | "criptoya" | "yadio"; at: string } | null;
}

/** La tasa con la que la tienda calcula sus precios en bolívares. */
export interface StoreRate {
  rate: number | null;
  auto: boolean;
  /** De dónde sale la automática (ver lib/exchange-rate.ts). */
  source: ExchangeRateSource;
  /** Ajuste en % sobre esa tasa. */
  margin: number;
  showBs: boolean;
}

type RateId = "usd" | "eur" | "usdt";

/** La pestaña de cada fuente, y cómo se nombra en el pie del menú. */
const STORE_SOURCE: Record<ExchangeRateSource, { id: RateId; name: string }> = {
  bcv_usd: { id: "usd", name: "$ dólar BCV" },
  bcv_eur: { id: "eur", name: "€ euro BCV" },
  usdt: { id: "usdt", name: "₮ USDT" },
};

interface RateOption {
  id: RateId;
  sym: string;
  name: string;
  /** Lo que dice la píldora junto al signo. */
  tag: string;
  /** De dónde sale, bajo el número de cada pestaña. */
  src: string;
  /** "Monto en dólares". */
  word: string;
  rate: number;
}

const STORAGE_KEY = "tiendify:tasa-panel";
const TO_BS_AMOUNTS = [1, 5, 10, 20, 50, 100];
const FROM_BS_AMOUNTS = [1000, 5000, 10000, 20000, 50000, 100000];

const num = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** El círculo con el signo de cada moneda. */
const COIN: Record<RateId, string> = {
  usd: "bg-brand-100 text-brand-700",
  eur: "bg-[#ECEAFB] text-[#4B3BB8]",
  usdt: "bg-[#DDF5EC] text-[#11755A]",
};

function buildOptions(rates: PanelRates): RateOption[] {
  const out: RateOption[] = [];
  if (rates.usd) {
    out.push({ id: "usd", sym: "$", name: "Dólar", tag: "BCV", src: "BCV", word: "dólares", rate: rates.usd });
  }
  if (rates.eur) {
    out.push({ id: "eur", sym: "€", name: "Euro", tag: "BCV", src: "BCV", word: "euros", rate: rates.eur });
  }
  if (rates.usdt) {
    out.push({
      id: "usdt",
      sym: "₮",
      name: "USDT",
      tag: "USDT",
      src: rates.usdt.source === "yadio" ? "Yadio" : "Binance P2P",
      word: "USDT",
      rate: rates.usdt.rate,
    });
  }
  return out;
}

/** "hace 12 min", como lo diría una persona. */
function agoLabel(iso: string): string {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `hace ${hours} h` : "hace más de un día";
}

/**
 * La línea bajo el resultado: el mismo monto con la otra tasa. Dólar y USDT se
 * comparan entre sí (es la diferencia que el comerciante quiere ver); el euro
 * se lleva a dólares, que es como se piensa un precio.
 */
function compareLine(
  sel: RateOption,
  byId: Partial<Record<RateId, RateOption>>,
  amount: number | null,
  toBs: boolean,
): string | null {
  if (amount === null || amount <= 0) return null;
  const { usd, usdt } = byId;
  if (toBs) {
    const bs = amount * sel.rate;
    if (sel.id === "usd" && usdt) {
      const other = amount * usdt.rate;
      const diff = other - bs;
      return `Al precio del USDT serían Bs ${num.format(other)}: Bs ${num.format(Math.abs(diff))} ${diff >= 0 ? "más" : "menos"}.`;
    }
    if (sel.id === "usdt" && usd) {
      const other = amount * usd.rate;
      const diff = bs - other;
      return `A tasa BCV serían Bs ${num.format(other)}: Bs ${num.format(Math.abs(diff))} ${diff >= 0 ? "menos" : "más"}.`;
    }
    if (sel.id === "eur" && usd) {
      return `Equivale a $ ${num.format(bs / usd.rate)} a tasa BCV del dólar.`;
    }
    return null;
  }
  if (sel.id === "usd" && usdt) {
    return `Al precio del USDT alcanza para ₮ ${num.format(amount / usdt.rate)}.`;
  }
  if (sel.id !== "usd" && usd) {
    return `A tasa BCV del dólar serían $ ${num.format(amount / usd.rate)}.`;
  }
  return null;
}

interface RateMenuProps {
  rates: PanelRates;
  store: StoreRate;
  /** "dark" para la barra noche del teléfono: ahí se abre como hoja. */
  tone?: "light" | "dark";
}

export function RateMenu({ rates, store, tone = "light" }: RateMenuProps) {
  const pathname = usePathname();
  const options = useMemo(() => buildOptions(rates), [rates]);
  const storeTab = store.auto ? STORE_SOURCE[store.source].id : "usd";
  const preferred: RateId = options.some((o) => o.id === storeTab) ? storeTab : "usd";

  const [picked, setPicked] = useState<RateId>(preferred);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("20");
  const [toBs, setToBs] = useState(true);
  const [copied, setCopied] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const sheet = tone === "dark";

  // La moneda elegida se recuerda en este navegador.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "usd" || saved === "eur" || saved === "usdt") setPicked(saved);
    } catch {
      // Sin almacenamiento (modo privado): queda la moneda de la tienda.
    }
  }, []);

  // Escape cierra; en escritorio también tocar afuera. La hoja del teléfono
  // tiene su fondo para eso y bloquea el scroll de la página mientras está.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    if (!sheet) document.addEventListener("pointerdown", onDown);
    const prevOverflow = document.body.style.overflow;
    if (sheet) document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      if (sheet) document.body.style.overflow = prevOverflow;
    };
  }, [open, sheet]);

  // Al abrir: en escritorio el cursor va directo a la calculadora; en el
  // teléfono no, porque abriría el teclado encima de las tasas.
  useEffect(() => {
    if (!open) return;
    if (sheet) {
      dialogRef.current?.focus();
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [open, sheet]);

  // Al navegar se cierra solo.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const sel =
    options.find((o) => o.id === picked) ??
    options.find((o) => o.id === preferred) ??
    options[0];
  if (!sel) return null;

  const byId: Partial<Record<RateId, RateOption>> = Object.fromEntries(
    options.map((o) => [o.id, o]),
  );

  function choose(id: RateId) {
    setPicked(id);
    setCopied(false);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Se usa igual, solo que no se recuerda.
    }
  }

  function close(refocus: boolean) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  const amount = evalAmount(text);
  const result = amount === null ? null : toBs ? amount * sel.rate : amount / sel.rate;
  const resultText =
    result === null ? "—" : toBs ? `Bs ${num.format(result)}` : `${sel.sym} ${num.format(result)}`;
  const compare = compareLine(sel, byId, amount, toBs);

  function swap() {
    if (result !== null) setText(result.toFixed(2).replace(".", ","));
    setToBs((v) => !v);
    setCopied(false);
  }

  async function copy() {
    if (result === null) return;
    try {
      await navigator.clipboard.writeText(resultText);
      setCopied(true);
    } catch {
      // Sin permiso para el portapapeles: el número igual está a la vista.
    }
  }

  // Lo que dice la tasa elegida, en grande.
  const usdt = sel.id === "usdt" ? rates.usdt : null;
  const eyebrow = usdt
    ? `Precio del USDT · ${usdt.source === "yadio" ? "Yadio" : "Binance P2P"}`
    : `Tasa oficial BCV · ${sel.id === "eur" ? "euro" : "dólar"}`;
  let badge: { text: string; className: string } | null;
  let meta: string;
  if (usdt) {
    const usdRate = byId.usd?.rate;
    const gap = usdRate ? (usdt.rate / usdRate - 1) * 100 : null;
    badge =
      gap === null
        ? null
        : {
            text: `${gap >= 0 ? "+" : "−"}${oneDecimal.format(Math.abs(gap))}% ${gap >= 0 ? "sobre" : "bajo"} el BCV`,
            className: "bg-[#FFEDE3] text-[#A8401A]",
          };
    meta = `${usdt.source === "criptoya" ? "vía CriptoYa · " : ""}actualizado ${agoLabel(usdt.at)}`;
  } else {
    badge = { text: "Oficial", className: "bg-[#DCFCE7] text-[#166534]" };
    meta = rates.bcvDate ? `Rige desde el ${bcvDateLabel(rates.bcvDate)}` : "Publicada por el BCV";
  }

  const storeLine = !store.showBs ? (
    "Tu tienda no muestra precios en bolívares."
  ) : !store.rate ? (
    "Tu tienda todavía no tiene tasa para los precios en Bs."
  ) : store.auto ? (
    <>
      Tus precios en Bs se actualizan solos con el{" "}
      <b className="font-semibold text-foreground">
        {STORE_SOURCE[store.source].name}
        {store.margin ? ` ${marginLabel(store.margin)}` : ""}
      </b>
      .
    </>
  ) : (
    <>
      Tus precios en Bs usan tu tasa de{" "}
      <b className="font-semibold text-foreground">{num.format(store.rate)}</b>, puesta a mano.
    </>
  );

  const amounts = toBs ? TO_BS_AMOUNTS : FROM_BS_AMOUNTS;

  const panel = (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-display text-base font-bold">
          Tasa del día
        </h2>
        {sheet ? (
          <button
            type="button"
            onClick={() => close(true)}
            className="h-10 rounded-[10px] bg-ink-100 px-3.5 text-sm font-semibold"
          >
            Listo
          </button>
        ) : (
          <button
            type="button"
            onClick={() => close(true)}
            aria-label="Cerrar"
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink-100 hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div
        role="group"
        aria-label="Moneda"
        className={cn(
          "grid gap-2",
          options.length === 3 ? "grid-cols-3" : options.length === 2 ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        {options.map((o) => {
          const on = o.id === sel.id;
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={on}
              aria-label={`${o.name}, ${o.src}: ${num.format(o.rate)} bolívares`}
              onClick={() => choose(o.id)}
              className={cn(
                "flex min-h-11 flex-col items-start gap-px rounded-xl border p-2.5 text-left transition-colors duration-150",
                on
                  ? "border-brand-600 bg-brand-50 shadow-[inset_0_0_0_1px_hsl(var(--brand-600))]"
                  : "border-border bg-card hover:border-ink-300 hover:bg-ink-25",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mb-1 grid size-6 place-items-center rounded-full font-landing-mono text-[13px] font-bold",
                  COIN[o.id],
                )}
              >
                {o.sym}
              </span>
              <span className="text-[13px] font-bold">{o.name}</span>
              <span className="font-landing-mono text-[12.5px] tabular-nums">{num.format(o.rate)}</span>
              <span className="text-[11px] text-muted-foreground">{o.src}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {eyebrow}
        </p>
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
            {num.format(sel.rate)}
          </span>
          <span className="font-landing-mono text-[12.5px] text-muted-foreground">
            Bs por {sel.sym}1
          </span>
        </p>
        <p className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          {badge && (
            <span
              className={cn(
                "inline-flex h-[22px] items-center rounded-full px-2 text-xs font-bold tabular-nums",
                badge.className,
              )}
            >
              {badge.text}
            </span>
          )}
          {meta}
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-[14px] border border-ink-100 bg-surface p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-bold">Calculadora</p>
          {/* El teclado numérico del teléfono no trae ×: la pista solo en
              escritorio. */}
          {!sheet && (
            <span className="text-[11.5px] text-muted-foreground">acepta cuentas: 3×12,50</span>
          )}
        </div>
        <label
          htmlFor={inputId}
          className="flex cursor-text flex-col gap-0.5 rounded-[10px] border border-border bg-card px-3 py-2 transition-[border-color,box-shadow] duration-150 focus-within:border-brand-600 focus-within:shadow-[0_0_0_3px_hsl(var(--brand-600)/0.16)]"
        >
          <span className="text-xs font-semibold text-muted-foreground">
            {toBs ? `Monto en ${sel.word}` : "Monto en bolívares"}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-landing-mono text-lg font-semibold text-muted-foreground">
              {toBs ? sel.sym : "Bs"}
            </span>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setCopied(false);
              }}
              className="w-full min-w-0 bg-transparent p-0 font-landing-mono text-[22px] font-semibold tabular-nums outline-none"
            />
          </span>
        </label>

        <div className="flex items-center gap-2">
          <span className="h-px flex-1 bg-border" />
          <button
            type="button"
            onClick={swap}
            aria-label="Invertir la conversión"
            title="Invertir"
            className={cn(
              "grid place-items-center rounded-full border border-border bg-card transition-colors duration-150 hover:border-brand-600 hover:text-brand-700",
              sheet ? "size-11" : "size-9",
            )}
          >
            <ArrowUpDown className="size-4" />
          </button>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-1 rounded-[10px] bg-noche px-3 py-2.5 text-white">
          <span className="text-xs font-semibold text-niebla">
            {toBs ? "Son, en bolívares" : `Son, en ${sel.word}`}
          </span>
          <div className="flex items-center justify-between gap-2">
            <output
              htmlFor={inputId}
              aria-live="polite"
              className="truncate font-landing-mono text-[22px] font-semibold tabular-nums text-sol"
            >
              {resultText}
            </output>
            <button
              type="button"
              onClick={copy}
              disabled={result === null}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-2.5 text-[12.5px] font-semibold transition-colors hover:bg-white/[0.18] disabled:opacity-40",
                sheet ? "h-10" : "h-8",
              )}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>

        <div className={cn("gap-1.5", sheet ? "grid grid-cols-3" : "flex flex-wrap")}>
          {amounts.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setText(String(value));
                setCopied(false);
              }}
              className={cn(
                "rounded-full border border-border bg-card px-2.5 font-landing-mono text-xs tabular-nums transition-colors duration-150 hover:border-brand-600 hover:text-brand-700",
                sheet ? "h-10 text-[13px]" : "h-[30px]",
              )}
            >
              {toBs ? `${sel.sym}${value}` : `Bs ${whole.format(value)}`}
            </button>
          ))}
        </div>

        {compare && <p className="text-[12.5px] leading-relaxed text-ink-600">{compare}</p>}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-3 text-[12.5px] text-muted-foreground">
        <span>{storeLine}</span>
        <Link
          href="/panel/configuracion"
          className="shrink-0 font-semibold text-brand-700 hover:underline"
        >
          Cambiar
        </Link>
      </div>
    </>
  );

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Tasa del día: ${sel.name}${sel.tag === sel.name ? "" : ` ${sel.tag}`}, ${num.format(sel.rate)} bolívares. Abre la calculadora.`}
        title="Tasa del día y calculadora"
        className={cn(
          "inline-flex h-9 items-center gap-[7px] rounded-full pl-3 pr-2.5 font-landing-mono text-[12.5px] tabular-nums",
          "transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sheet
            ? "bg-white/[0.08] text-white"
            : "border border-border bg-surface text-foreground hover:border-ink-300",
          open &&
            (sheet
              ? "shadow-[0_0_0_2px_hsl(var(--brand-400)/0.6)]"
              : "border-brand-600 shadow-[0_0_0_3px_hsl(var(--brand-600)/0.16)] hover:border-brand-600"),
        )}
      >
        <span aria-hidden="true" className="size-[7px] rounded-full bg-[#16A34A]" />
        <span className={cn("font-semibold", sheet ? "text-brand-300" : "text-brand-700")}>
          {sel.sym}
        </span>
        {/* En la barra del teléfono no entra "BCV": el signo ya distingue
            ($ y € son del BCV, ₮ es USDT) y el nombre de la tienda necesita
            el lugar. */}
        <span>
          {!sheet && `${sel.tag} `}
          {num.format(sel.rate)}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-200",
            open && "rotate-180",
            sheet ? "text-white/60" : "text-muted-foreground",
          )}
        />
      </button>

      {open && !sheet && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="absolute right-0 top-[calc(100%+10px)] z-40 flex w-[392px] max-w-[calc(100vw-2rem)] flex-col gap-3.5 rounded-2xl border border-border bg-card p-4 text-foreground shadow-[0_18px_48px_-12px_rgb(11_27_43/0.28),0_2px_6px_rgb(11_27_43/0.06)] duration-150 animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1"
        >
          {panel}
        </div>
      )}

      {/* La hoja va al body: dentro de la barra pegajosa quedaría debajo de
          la navegación de abajo. Se le vuelven a poner las letras y la paleta
          del panel, que viven en el contenedor del layout. */}
      {open &&
        sheet &&
        createPortal(
          <div className={cn(landingFonts, "chrome-panel font-landing-body text-foreground antialiased md:hidden")}>
            <div
              className="fixed inset-0 z-50 bg-ink-950/45 backdrop-blur-[2px] duration-200 animate-in fade-in-0"
              onClick={() => close(false)}
              aria-hidden="true"
            />
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col gap-3 overflow-y-auto rounded-t-3xl bg-card px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2.5 shadow-pop outline-none duration-300 animate-in slide-in-from-bottom"
            >
              <div aria-hidden="true" className="mx-auto h-1 w-9 shrink-0 rounded-full bg-ink-300" />
              {panel}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
