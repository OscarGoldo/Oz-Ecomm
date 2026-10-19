import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ExternalLink, Search } from "lucide-react";

import { CopyStoreAddress } from "@/components/admin/copy-store-address";
import { FREE_MAX_PRODUCTS } from "@/lib/plans";
import { cn } from "@/lib/utils";

/**
 * Piezas fijas del panel del vendedor (las que arma el layout alrededor de
 * cada pantalla): la ficha de la tienda, la tarjeta del plan y el buscador de
 * pedidos. Sin estado: son de servidor. La tasa del día, que sí tiene estado,
 * está en rate-menu.tsx.
 */

/** El cuadrado de la tienda: su logo, o la inicial en el azul de marca. */
export function StoreMark({
  name,
  logo,
  className,
}: {
  name: string;
  logo: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-brand-600 text-sm font-extrabold text-white",
        className,
      )}
    >
      {logo ? (
        <Image src={logo} alt="" width={36} height={36} className="size-full object-cover" />
      ) : (
        name.trim().charAt(0).toUpperCase() || "T"
      )}
    </span>
  );
}

/** Arriba de la barra lateral: qué tienda es, su link para copiar y cómo abrirla. */
export function PanelStoreCard({
  name,
  logo,
  url,
  address,
}: {
  name: string;
  logo: string | null;
  url: string;
  address: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-noche-suave p-2.5">
      <StoreMark name={name} logo={logo} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-bold">{name}</p>
        <CopyStoreAddress url={url} address={address} />
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Ver tu tienda"
        className="grid size-8 shrink-0 place-items-center rounded-lg text-niebla transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <ExternalLink className="size-4" />
      </a>
    </div>
  );
}

/**
 * El plan, abajo de la barra lateral. En Gratis muestra cuánto del cupo de
 * productos va usado, que es el límite con el que la tienda se topa primero.
 */
export function PanelPlanCard({
  pro,
  daysLeft,
  productCount,
}: {
  pro: boolean;
  daysLeft: number | null;
  productCount: number;
}) {
  const used = Math.min(100, Math.round((productCount / FREE_MAX_PRODUCTS) * 100));

  // En Pro la tarjeta es de una línea: no hay cupo que mirar, solo cuándo
  // vence (si vence).
  if (pro) {
    return (
      <Link
        href="/panel/plan"
        className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-noche-suave px-3.5 py-3 transition-colors hover:border-white/20"
      >
        <span className="min-w-0">
          <span className="block font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-niebla">
            Plan Pro
          </span>
          <span className="mt-0.5 block truncate text-[13px] text-white/75">
            {daysLeft === null
              ? "Sin fecha de vencimiento"
              : daysLeft > 0
                ? `Vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
                : "Venció, renuévalo"}
          </span>
        </span>
        <ArrowRight className="size-4 shrink-0 text-sol" />
      </Link>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-noche-suave p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-landing-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-niebla">
          Plan Gratis
        </p>
        <p className="font-landing-mono text-xs tabular-nums text-white">
          {productCount} / {FREE_MAX_PRODUCTS}
        </p>
      </div>
      <div className="mt-2.5 h-1.5 rounded-full bg-white/[0.12]">
        <div className="h-1.5 rounded-full bg-brand-400" style={{ width: `${used}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-white/75">productos cargados</p>
      <Link
        href="/panel/plan"
        className="mt-2.5 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-sol hover:underline"
      >
        Pasar a Pro <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/**
 * Buscador de la barra de arriba. Busca pedidos, que es lo que el dueño tiene
 * a mano cuando un cliente le escribe: lleva a /panel/pedidos?q=… y ahí se
 * filtra por número, nombre o teléfono.
 */
export function PanelSearch() {
  return (
    <form action="/panel/pedidos" role="search" className="w-full max-w-[26rem]">
      <label className="flex h-10 items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 text-ink-500 transition-[border-color,box-shadow] focus-within:border-ring focus-within:shadow-[0_0_0_3px_hsl(var(--ring)/0.18)]">
        <Search className="size-4 shrink-0" />
        <span className="sr-only">Buscar pedidos</span>
        <input
          type="search"
          name="q"
          inputMode="search"
          placeholder="Buscar pedido por número, cliente o teléfono"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-ink-500"
        />
      </label>
    </form>
  );
}
