import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Eye, ImageOff, ShoppingBag, Star } from "lucide-react";

import { StockQuickEdit } from "@/components/admin/stock-quick-edit";
import { formatUSD } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductStatus } from "@/types/database";

/**
 * Los productos del panel en dos formas: tarjetas con foto (escritorio) y
 * filas (teléfono, o escritorio en vista de lista). Toda la tarjeta lleva al
 * producto; el −/+ de stock queda por encima del enlace para sumar sin abrir.
 */

export interface CatalogItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
  compareAt: number | null;
  cover: string | null;
  status: ProductStatus;
  featured: boolean;
  trackStock: boolean;
  stock: number;
  lowThreshold: number;
  /** Últimos 30 días. */
  views: number;
  sold: number;
  /** "Sin foto", "Sin costo"…: lo más urgente de arreglar, si hay algo. */
  warning: string | null;
}

const STOCK = {
  free: { label: "Stock libre", dot: "bg-[#BFCEDD]", text: "text-ink-500" },
  zero: { label: "Agotado", dot: "bg-[#eb6834]", text: "text-[#A8401A]" },
  low: { label: "Quedan pocos", dot: "bg-[#D97706]", text: "text-[#92400E]" },
  ok: { label: "En stock", dot: "bg-[#16A34A]", text: "text-[#166534]" },
} as const;

function stockState(p: CatalogItem): keyof typeof STOCK {
  if (!p.trackStock) return "free";
  if (p.stock <= 0) return "zero";
  if (p.stock <= p.lowThreshold) return "low";
  return "ok";
}

function salePct(p: CatalogItem): number | null {
  if (p.compareAt == null || p.compareAt <= p.price || p.compareAt <= 0) return null;
  // Entre 1 y 99: $1 antes $999 no es "−100%".
  return Math.min(99, Math.max(1, Math.round((1 - p.price / p.compareAt) * 100)));
}

function StockLabel({ item }: { item: CatalogItem }) {
  const s = STOCK[stockState(item)];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold", s.text)}>
      <span className={cn("size-[7px] rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

function Stepper({ item }: { item: CatalogItem }) {
  if (!item.trackStock) return null;
  return (
    <div className="relative z-10">
      <StockQuickEdit productId={item.id} stock={item.stock} lowThreshold={item.lowThreshold} compact />
    </div>
  );
}

function StatusPill({ status }: { status: ProductStatus }) {
  if (status === "active") return null;
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center rounded-md px-1.5 text-[11px] font-bold",
        status === "draft" ? "bg-[#EEF3F8] text-pizarra" : "bg-[#F3F1EC] text-[#6B5E45]",
      )}
    >
      {status === "draft" ? "Borrador" : "Archivado"}
    </span>
  );
}

/** El nombre es el enlace; su ::after cubre toda la tarjeta o la fila. */
function NameLink({ item, className }: { item: CatalogItem; className?: string }) {
  return (
    <Link
      href={`/panel/productos/${item.id}`}
      className={cn(
        "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring",
        className,
      )}
    >
      {item.name}
    </Link>
  );
}

function Activity({ item }: { item: CatalogItem }) {
  return (
    <>
      <span className="inline-flex items-center gap-1" title="Vistas en 30 días">
        <Eye className="size-3.5" aria-hidden="true" />
        {item.views}
        <span className="sr-only"> vistas</span>
      </span>
      <span className="inline-flex items-center gap-1" title="Unidades vendidas en 30 días">
        <ShoppingBag className="size-3.5" aria-hidden="true" />
        {item.sold}
        <span className="sr-only"> vendidos</span>
      </span>
    </>
  );
}

// ── Tarjetas ────────────────────────────────────────────────────────────────

export function ProductGrid({ items, className }: { items: CatalogItem[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-3 gap-4 xl:grid-cols-4", className)}>
      {items.map((p) => {
        const sale = salePct(p);
        const out = p.trackStock && p.stock <= 0;
        return (
          <li key={p.id}>
            <article
              className={cn(
                "relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-[border-color,box-shadow] duration-150",
                "hover:border-[#C2CFDC] hover:shadow-[0_8px_24px_-12px_rgba(11,27,43,0.25)]",
                p.status === "archived" && "opacity-70",
              )}
            >
              <div className="relative aspect-[4/3] bg-claro">
                {p.cover ? (
                  <Image
                    src={p.cover}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 270px, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-niebla">
                    <ImageOff className="size-8" aria-hidden="true" />
                  </span>
                )}
                <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                  {p.featured && (
                    <span className="inline-flex h-[22px] items-center gap-1 rounded-full bg-white px-2 text-[11.5px] font-bold text-noche shadow-[0_1px_2px_rgba(11,27,43,0.12)]">
                      <Star className="size-3 fill-[#E0B400] text-[#E0B400]" aria-hidden="true" />
                      Destacado
                    </span>
                  )}
                  {sale != null && (
                    <span className="inline-flex h-[22px] items-center rounded-full bg-[#eb6834] px-2 text-[11.5px] font-bold text-white">
                      −{sale}%
                    </span>
                  )}
                  {p.status !== "active" && (
                    <span className="inline-flex h-[22px] items-center rounded-full bg-pizarra px-2 text-[11.5px] font-bold text-white">
                      {p.status === "draft" ? "Borrador" : "Archivado"}
                    </span>
                  )}
                </div>
                {out && (
                  <div className="absolute inset-0 grid place-items-center bg-noche/45">
                    <span className="rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-[#A8401A]">
                      Agotado
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1.5 px-3.5 pb-3 pt-3.5">
                <p className="truncate font-landing-mono text-[10.5px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                  {p.category ?? "Sin categoría"}
                </p>
                <h3 className="line-clamp-2 text-[15px] font-bold leading-[1.3]">
                  <NameLink item={p} />
                </h3>
                <p className="flex items-baseline gap-1.5">
                  <span className="font-display text-[19px] font-extrabold tabular-nums">{formatUSD(p.price)}</span>
                  {sale != null && p.compareAt != null && (
                    <s className="text-[12.5px] text-ink-400">{formatUSD(p.compareAt)}</s>
                  )}
                </p>
                <div className="mt-auto flex min-h-8 items-center justify-between gap-2 pt-1">
                  <StockLabel item={p} />
                  <Stepper item={p} />
                </div>
              </div>

              <div className="flex items-center gap-3 border-t border-[#EEF3F8] px-3.5 py-2.5 text-xs text-ink-500">
                <Activity item={p} />
                {p.warning ? (
                  <span className="ml-auto truncate font-semibold text-[#92400E]">{p.warning}</span>
                ) : (
                  <span className="ml-auto text-ink-400">30 días</span>
                )}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}

// ── Filas ───────────────────────────────────────────────────────────────────

export function ProductRows({ items, className }: { items: CatalogItem[]; className?: string }) {
  return (
    <ul className={cn("divide-y divide-[#EEF3F8] overflow-hidden rounded-2xl border bg-card", className)}>
      {items.map((p) => {
        const sale = salePct(p);
        const out = p.trackStock && p.stock <= 0;
        return (
          <li
            key={p.id}
            className={cn(
              "relative flex items-center gap-3 p-3 transition-colors hover:bg-[#FAFCFE] lg:gap-4 lg:px-4",
              p.status === "archived" && "opacity-70",
            )}
          >
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-claro lg:size-12">
              {p.cover ? (
                <Image src={p.cover} alt="" fill sizes="64px" className="object-cover" />
              ) : (
                <span className="grid h-full place-items-center text-niebla">
                  <ImageOff className="size-5" aria-hidden="true" />
                </span>
              )}
              {out && (
                <span className="absolute inset-0 grid place-items-center bg-noche/50 text-[10px] font-bold uppercase tracking-[0.04em] text-white">
                  Agotado
                </span>
              )}
              {p.featured && (
                <span
                  className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(11,27,43,0.2)]"
                  title="Destacado"
                >
                  <Star className="size-3 fill-[#E0B400] text-[#E0B400]" aria-hidden="true" />
                  <span className="sr-only">Destacado</span>
                </span>
              )}
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="flex items-center gap-2 font-landing-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-500">
                <span className="truncate">{p.category ?? "Sin categoría"}</span>
              </p>
              <p className="line-clamp-2 text-[15px] font-bold leading-[1.25] lg:line-clamp-1">
                <NameLink item={p} />
              </p>
              {/* Teléfono: precio y actividad debajo del nombre. */}
              <p className="flex flex-wrap items-baseline gap-x-1.5 lg:hidden">
                <span className="font-display text-[17px] font-extrabold tabular-nums">{formatUSD(p.price)}</span>
                {sale != null && p.compareAt != null && (
                  <>
                    <s className="text-xs text-ink-400">{formatUSD(p.compareAt)}</s>
                    <span className="text-[11px] font-bold text-[#A8401A]">−{sale}%</span>
                  </>
                )}
                <StatusPill status={p.status} />
              </p>
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-ink-500 lg:hidden">
                <Activity item={p} />
                {p.warning && <span className="font-semibold text-[#92400E]">{p.warning}</span>}
              </p>
              <span className="hidden lg:block">
                <StatusPill status={p.status} />
              </span>
            </div>

            {/* Escritorio: columnas. */}
            <div className="hidden w-28 shrink-0 text-right lg:block">
              <p className="font-display text-[17px] font-extrabold tabular-nums">{formatUSD(p.price)}</p>
              {sale != null && p.compareAt != null && (
                <p className="text-xs text-ink-400">
                  <s>{formatUSD(p.compareAt)}</s> <span className="font-bold text-[#A8401A]">−{sale}%</span>
                </p>
              )}
            </div>
            <div className="hidden w-40 shrink-0 flex-col gap-0.5 text-xs text-ink-500 lg:flex">
              <span className="flex items-center gap-2.5">
                <Activity item={p} />
              </span>
              {p.warning ? (
                <span className="font-semibold text-[#92400E]">{p.warning}</span>
              ) : (
                <span className="text-ink-400">30 días</span>
              )}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5 lg:w-[200px] lg:flex-row lg:items-center lg:justify-end lg:gap-3">
              <StockLabel item={p} />
              <Stepper item={p} />
            </div>
            <ChevronRight className="hidden size-4 shrink-0 text-ink-400 lg:block" aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
}
