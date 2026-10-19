"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ArrowRight, Lock } from "lucide-react";

import { pill } from "@/components/landing/landing-ui";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

/**
 * El nombre del negocio que la persona escribe en la landing.
 *
 * Es el momento central de la portada: escribe "Dulces Mary" y la tienda del
 * teléfono, su link, los pasos y su subdominio pasan a decir Dulces Mary.
 * Ver tu propia tienda antes de registrarte convence más que cualquier frase.
 *
 * Hasta que toque el campo, el hero escribe solo unos nombres de ejemplo para
 * que se entienda qué hace. Con "reducir movimiento" no escribe nada.
 */

const DEMO_NAMES = ["Dulces Mary", "Tecno Caracas", "Moda Valencia", "Bisutería Luna"];
const FALLBACK_NAME = "Tu tienda";
const FALLBACK_SLUG = "tu-tienda";

interface StoreNameState {
  value: string;
  setValue: (value: string) => void;
  demo: string | null;
  stopDemo: () => void;
}

const StoreNameContext = createContext<StoreNameState | null>(null);

export function StoreNameProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState("");
  const [demo, setDemo] = useState<string | null>(null);
  const [demoOn, setDemoOn] = useState(true);

  useEffect(() => {
    if (!demoOn) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: ReturnType<typeof setTimeout>;
    let word = 0;
    let chars = 0;
    let deleting = false;

    // Escribe, espera, borra hasta la primera letra y salta al siguiente
    // nombre. Nunca queda vacío: si quedara, el teléfono volvería a decir
    // "Tu tienda" un instante y parpadearía.
    const tick = () => {
      const name = DEMO_NAMES[word % DEMO_NAMES.length]!;
      chars += deleting ? -1 : 1;
      setDemo(name.slice(0, chars));
      if (!deleting && chars >= name.length) {
        deleting = true;
        timer = setTimeout(tick, 1900);
      } else if (deleting && chars <= 1) {
        deleting = false;
        word += 1;
        chars = 0;
        timer = setTimeout(tick, 260);
      } else {
        timer = setTimeout(tick, deleting ? 32 : 80);
      }
    };

    timer = setTimeout(tick, 1500);
    return () => clearTimeout(timer);
  }, [demoOn]);

  const stopDemo = useCallback(() => {
    setDemoOn(false);
    setDemo(null);
  }, []);

  const state = useMemo(
    () => ({ value, setValue, demo, stopDemo }),
    [value, demo, stopDemo],
  );

  return <StoreNameContext.Provider value={state}>{children}</StoreNameContext.Provider>;
}

function useStoreName(): StoreNameState {
  const ctx = useContext(StoreNameContext);
  if (!ctx) throw new Error("StoreName* tiene que ir dentro de <StoreNameProvider>");
  return ctx;
}

/** Lo que se muestra: lo escrito, si no el ejemplo, si no "Tu tienda". */
function useDisplay() {
  const { value, demo } = useStoreName();
  const raw = value.trim() || demo || "";
  // El mismo slugify que usa el registro: el link que ve acá es el que va a tener.
  return { name: raw || FALLBACK_NAME, slug: slugify(raw) || FALLBACK_SLUG };
}

export function StoreName() {
  return <>{useDisplay().name}</>;
}

export function StoreSlug() {
  return <>{useDisplay().slug}</>;
}

export function StoreInitial() {
  return <>{useDisplay().name.charAt(0).toUpperCase()}</>;
}

/**
 * El campo "nombre de tu negocio" + "Crear mi tienda gratis".
 *
 * Es un <form method="get"> a /crear-tienda con `nombre`: funciona sin
 * JavaScript, y el registro llega con el nombre ya puesto en vez de pedirlo
 * dos veces.
 */
export function StoreClaimForm({
  id,
  label,
  tone,
  animatePlaceholder = false,
}: {
  id: string;
  label: string;
  /** `flood` sobre el azul del hero, `night` sobre la banda noche del cierre. */
  tone: "flood" | "night";
  /** Solo el del hero muestra los nombres de ejemplo escribiéndose. */
  animatePlaceholder?: boolean;
}) {
  const { value, setValue, demo, stopDemo } = useStoreName();
  const { slug } = useDisplay();
  const night = tone === "night";

  return (
    <form action="/crear-tienda" method="get" className="w-full max-w-[580px]">
      <label
        htmlFor={id}
        className={cn("mb-2 block text-[14.5px] font-bold", night && "text-claro")}
      >
        {label}
      </label>
      <div
        className={cn(
          "flex gap-1.5 rounded-full bg-white p-1.5 shadow-[0_1px_0_hsl(var(--noche)/0.28),0_22px_44px_-20px_hsl(var(--noche)/0.5)] transition-shadow max-sm:flex-col max-sm:rounded-[22px] max-sm:p-2",
          night
            ? "focus-within:ring-[3px] focus-within:ring-sol"
            : "focus-within:ring-[3px] focus-within:ring-noche",
        )}
      >
        <input
          id={id}
          name="nombre"
          type="text"
          autoComplete="organization"
          maxLength={60}
          value={value}
          placeholder={animatePlaceholder && demo ? demo : "Ej.: Dulces Mary"}
          onFocus={stopDemo}
          onChange={(e) => {
            stopDemo();
            setValue(e.target.value);
          }}
          className="min-w-0 flex-1 bg-transparent pl-[18px] pr-2.5 text-[17px] font-semibold text-noche outline-none placeholder:font-medium placeholder:text-gris max-sm:min-h-12 max-sm:px-3"
        />
        <button
          type="submit"
          className={cn(
            pill,
            "max-sm:w-full focus-visible:outline-offset-2",
            night
              ? "bg-sol text-noche focus-visible:outline-sol"
              : "bg-noche text-white focus-visible:outline-noche",
          )}
        >
          Crear mi tienda gratis
          <ArrowRight aria-hidden="true" />
        </button>
      </div>

      <p className="mt-3.5 flex flex-wrap items-center gap-2 font-landing-mono text-sm">
        <span className={cn(night && "text-niebla")}>Tu link:</span>
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-2.5 py-1",
            night ? "bg-white/10 text-claro" : "bg-white/90 text-noche",
          )}
        >
          <Lock aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
          <span className="truncate">
            <b className={cn("font-semibold", night ? "text-sol" : "text-brand-700")}>
              {slug}
            </b>
            .usatiendify.com
          </span>
        </span>
      </p>
      <p className={cn("mt-3 text-[14.5px]", night ? "text-niebla" : "text-noche/90")}>
        Gratis hasta {FREE_MAX_PRODUCTS} productos. Sin tarjeta de crédito.
      </p>
    </form>
  );
}
