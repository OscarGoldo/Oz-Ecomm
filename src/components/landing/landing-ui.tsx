import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Piezas compartidas por las secciones de la landing. Sin "use client" ni
 * nada de servidor: las usan tanto las secciones estáticas como las
 * interactivas (precios, plantillas).
 */

/** El ancho de columna de toda la landing: 1240px con un margen que crece. */
export const wrap = "mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10";

/** Espaciado vertical de una sección. */
export const sectionY = "py-[clamp(76px,9vw,132px)]";

/** Botón píldora. El color va aparte: noche en claro, sol sobre noche. */
export const pill =
  "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-base font-bold transition-transform duration-200 ease-out active:scale-[0.97] [&_svg]:size-[18px] [&_svg]:transition-transform [&_svg]:duration-200 hover:[&_svg]:translate-x-0.5";

/** Titular de sección: la display apretada, en negro. */
export const headingXl =
  "text-balance font-landing-display font-extrabold leading-[0.96] tracking-[-0.042em] [font-stretch:84%]";

/**
 * Los tokens que usan los componentes de formulario (Input, Button,
 * PhoneInput), con los valores de la portada: botón en noche, bordes fríos,
 * foco en el azul de marca y esquinas más redondas. Se ponen en el `style` del
 * contenedor del formulario y todo lo de adentro los toma.
 *
 * Vive acá y no en signup-shell porque ese archivo es "use client": lo que
 * exporta, importado desde un componente de servidor, llega como referencia y
 * no como el objeto.
 */
export const FORM_TOKENS = {
  "--background": "0 0% 100%",
  "--foreground": "210 59% 10.6%",
  "--card": "0 0% 100%",
  "--card-foreground": "210 59% 10.6%",
  "--primary": "210 59% 10.6%",
  "--primary-foreground": "0 0% 100%",
  "--muted": "210 50% 93.7%",
  "--muted-foreground": "212 22% 34.5%",
  "--border": "210 33% 88.2%",
  "--input": "210 31% 80.8%",
  "--ring": "199 89% 48%",
  "--radius": "0.875rem",
} as React.CSSProperties;

/**
 * Rótulo de sección. En mono y versalitas: es el "encima" del titular y evita
 * que arranque flotando, igual que en el resto de la plataforma.
 */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-landing-mono text-xs font-semibold uppercase tracking-[0.08em] text-brand-700",
        className,
      )}
    >
      {children}
    </p>
  );
}

/**
 * Atributos para que un elemento entre al bajar (ver ScrollReveal y las
 * reglas `data-reveal` de globals.css). `delay` escalona los de un mismo grupo;
 * `pop` entra con una leve escala, `wipe` se descubre de arriba hacia abajo y
 * `fly` llega volando (solo Pana).
 */
export function reveal(delay = 0, kind?: "pop" | "wipe" | "fly") {
  return {
    "data-reveal": "",
    ...(kind ? { "data-reveal-kind": kind } : {}),
    style: delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined,
  };
}

/** Rótulo, titular y bajada: el mismo ritmo en todas las secciones. */
export function SectionHeading({
  eyebrow,
  title,
  text,
  className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid max-w-[780px] gap-4", className)}>
      <div {...reveal()}>
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>
      {/* El tamaño va antes que headingXl: tailwind-merge descarta un
          interlineado que venga antes de un tamaño de letra. */}
      <h2 {...reveal(60, "wipe")} className={cn("text-[clamp(2.2rem,1.3rem+3vw,3.75rem)]", headingXl)}>
        {title}
      </h2>
      {text && (
        <p
          {...reveal(180)}
          className="max-w-[58ch] text-pretty text-[clamp(1.05rem,1rem+0.25vw,1.2rem)] leading-relaxed text-pizarra"
        >
          {text}
        </p>
      )}
    </div>
  );
}

/**
 * La palabra que se marca en un titular: amarilla, girada y con sombra dura,
 * como una calcomanía. Es el `*así*` de los posts de Instagram.
 */
export function Sticker({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-[0.03em] inline-block whitespace-nowrap rounded-[0.13em] bg-sol px-[0.17em] pb-[0.07em] pt-[0.02em] text-noche shadow-[0.05em_0.065em_0_hsl(var(--noche))] [rotate:-3deg]">
      {children}
    </span>
  );
}

/** El contorno de la etiqueta del logo, como gráfico de fondo. */
export function TagOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="8 14 52 52" aria-hidden="true" className={className}>
      <path
        d="M12 40 L34 18 H56 V40 L34 62 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={47}
        cy={27}
        r={4.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* --- Montos --------------------------------------------------------------- */

const bsFull = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const bsWhole = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });

/** "Bs 15.842,16". */
export function bs(usd: number, rate: number): string {
  return `Bs ${bsFull.format(usd * rate)}`;
}

/** "Bs 15.842": en una pantalla de 290px los céntimos estorban. */
export function bsShort(usd: number, rate: number): string {
  return `Bs ${bsWhole.format(usd * rate)}`;
}

/** La tasa sola: "880,12". */
export function rateText(rate: number): string {
  return bsFull.format(rate);
}

/** "$18,00", con la coma que se usa aquí. */
export function usd(amount: number): string {
  return `$${bsFull.format(amount)}`;
}

/* --- Productos de ejemplo ------------------------------------------------- */

/**
 * Fotos de producto de las tiendas de ejemplo, en public/landing/productos.
 * Son de Unsplash (licencia libre, uso comercial sin atribución), elegidas con
 * fondo limpio y sin marcas visibles: una tienda inventada no puede vender
 * productos de marcas reales. Al lado de cada una, su id en Unsplash.
 */
export const PHOTO = {
  franela: "/landing/productos/franela.webp", // photo-1651761179569-4ba2aa054997
  gorra: "/landing/productos/gorra.webp", // photo-1521369909029-2afed882baee
  tote: "/landing/productos/tote.webp", // photo-1574365569389-a10d488ca3fb
  lentes: "/landing/productos/lentes.webp", // photo-1584036553516-bf83210aa16c
  audifonos: "/landing/productos/audifonos.webp", // photo-1583394838336-acd977736f90
  reloj: "/landing/productos/reloj.webp", // photo-1660844817855-3ecc7ef21f12
  corneta: "/landing/productos/corneta.webp", // photo-1582978571763-2d039e56f0c3
  powerbank: "/landing/productos/powerbank.webp", // photo-1760708825913-65a50b3dc39b
  serum: "/landing/productos/serum.webp", // photo-1781344116880-029945a42b75
  labial: "/landing/productos/labial.webp", // photo-1625093742435-6fa192b6fb10
  crema: "/landing/productos/crema.webp", // photo-1763503839418-2b45c3d7a3c3
  perfume: "/landing/productos/perfume.webp", // photo-1705899844877-81bb0a0665c1
} as const;

/**
 * Los productos de la tienda del hero. Se repiten en el navegador, el
 * checkout, el aviso y los pedidos para que se lea como una sola historia: lo
 * que se ve en la tienda es lo que se pide y se paga.
 */
export const SAMPLE = {
  franela: { name: "Franela oversize", usd: 18, photo: PHOTO.franela },
  gorra: { name: "Gorra bordada", usd: 12, photo: PHOTO.gorra },
  tote: { name: "Tote de lona", usd: 15, photo: PHOTO.tote },
  lentes: { name: "Lentes de sol", usd: 22, photo: PHOTO.lentes },
} as const;

/**
 * Una foto de producto que llena su caja. Las cajas de los pantallazos son
 * chicas (hasta ~250px), así que `sizes` pide la versión pequeña.
 */
export function ProductPhoto({
  src,
  className,
  sizes = "160px",
  priority = false,
}: {
  src: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-[#F1F3F5]", className)}>
      <Image src={src} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
    </span>
  );
}

/**
 * Avatares de los ejemplos (bandeja de mensajes, pedidos). Tonos hondos para
 * que la inicial en blanco pase 4.5:1.
 */
export const AVATAR = {
  azul: "#0369A1",
  ambar: "#B45309",
  verde: "#0F766E",
  rosa: "#BE185D",
  pizarra: "#4D5B6B",
} as const;

export function Avatar({
  initial,
  color,
  className,
}: {
  initial: React.ReactNode;
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-[38px] shrink-0 place-items-center rounded-full text-sm font-bold text-white",
        className,
      )}
      style={{ background: color }}
    >
      {initial}
    </span>
  );
}
