import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { AccessoriesProductCard } from "@/components/storefront/accessories-product-card";
import { AthleteEditorialProductCard } from "@/components/storefront/athlete-editorial-product-card";
import { BeautyMinimalProductCard } from "@/components/storefront/beauty-minimal-product-card";
import { BeautyProductCard } from "@/components/storefront/beauty-product-card";
import { DiscoverProductCard } from "@/components/storefront/discover-product-card";
import { DropsProductCard } from "@/components/storefront/drops-product-card";
import { FashionProductCard } from "@/components/storefront/fashion-product-card";
import { ProductCard } from "@/components/storefront/product-card";
import { SportsProductCard } from "@/components/storefront/sports-product-card";
import { StreetProductCard } from "@/components/storefront/streetwear-product-card";
import { TechProductCard } from "@/components/storefront/tech-product-card";
import type { Density, LookId } from "@/lib/design/types";
import { cn } from "@/lib/utils";
import type { HomeContext } from "@/components/storefront/sections/context";
import type { Product } from "@/types/database";

/**
 * El "kit" de cada estilo: su tarjeta de producto, cómo se ven sus títulos y
 * cuánto aire lleva cada sección. Sale tal cual de las plantillas de siempre,
 * para que una tienda que pasa al editor nuevo se vea igual que antes.
 */

const SERIF = { fontFamily: "var(--font-heading, var(--font-lora))" } as const;

/** La tarjeta de producto del estilo. */
export function LookCard({ product, ctx }: { product: Product; ctx: HomeContext }) {
  const { store } = ctx;
  switch (ctx.cardLook) {
    case "fashion":
      return <FashionProductCard product={product} store={store} />;
    case "fashion-athletic":
      return <AthleteEditorialProductCard product={product} store={store} />;
    case "fashion-streetwear":
      return <StreetProductCard product={product} store={store} />;
    case "accessories":
      return <AccessoriesProductCard product={product} store={store} />;
    case "beauty":
      return <BeautyProductCard product={product} store={store} />;
    case "beauty-minimal":
      return <BeautyMinimalProductCard product={product} store={store} />;
    case "tech":
      return (
        <TechProductCard
          product={product}
          store={store}
          category={product.category_id ? (ctx.categoryNames.get(product.category_id) ?? null) : null}
          freeShipping={ctx.freeShipping}
        />
      );
    case "tech-discover":
      return <DiscoverProductCard product={product} store={store} />;
    case "sports":
      return <SportsProductCard product={product} store={store} />;
    case "sports-drops":
      return <DropsProductCard product={product} store={store} />;
    case "classic":
      return <ProductCard product={product} store={store} cardStyle={ctx.cardStyle} />;
  }
}

/** Aire y borde de cada sección según el estilo, tal como lo tenía su plantilla. */
const LOOK_SHELL: Record<LookId, { pad: string; border?: string }> = {
  classic: { pad: "pt-6" },
  fashion: { pad: "py-10" },
  "fashion-athletic": { pad: "py-12", border: "border-b" },
  "fashion-streetwear": { pad: "py-10", border: "border-b" },
  accessories: { pad: "py-12" },
  beauty: { pad: "py-8" },
  "beauty-minimal": { pad: "py-12" },
  tech: { pad: "py-6" },
  sports: { pad: "py-6" },
  "tech-discover": { pad: "pt-7" },
  "sports-drops": { pad: "py-8", border: "border-b border-foreground/10" },
};

/** "Normal" respeta el aire del estilo; las otras dos lo cambian para todas las secciones. */
const DENSITY_PAD: Record<Exclude<Density, "normal">, string> = {
  compacta: "py-5",
  amplia: "py-16 sm:py-20",
};

export function lookShell(look: LookId, density: Density = "normal"): string {
  const s = LOOK_SHELL[look];
  return cn(s.border, density === "normal" ? s.pad : DENSITY_PAD[density]);
}

/** Las secciones de texto que van centradas en este estilo. */
export function lookCentered(look: LookId): boolean {
  return ["fashion", "fashion-athletic", "accessories", "beauty-minimal"].includes(look);
}

/** La grilla del catálogo del estilo. */
export function lookGrid(look: LookId): string {
  switch (look) {
    case "fashion":
      return "grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-3";
    case "fashion-athletic":
      return "grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4";
    case "fashion-streetwear":
      return "grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4";
    case "accessories":
      return "grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-10 sm:gap-y-16";
    case "beauty-minimal":
      return "grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4";
    case "sports-drops":
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    default:
      return "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";
  }
}

/** Ancho de cada tarjeta en las filas que se deslizan. */
export function lookRowItem(look: LookId): string {
  switch (look) {
    case "classic":
      return "w-40 shrink-0 sm:w-48";
    case "beauty":
    case "sports-drops":
      return "w-40 shrink-0 sm:w-48";
    default:
      return "w-44 shrink-0 sm:w-56";
  }
}

export interface HeadingProps {
  ctx: HomeContext;
  title: string;
  subtitle?: string;
  /** "Ver todo" a la derecha. */
  action?: { href: string; label?: string };
  /** Punto de color de acento antes del título. */
  accent?: boolean;
  /** Título principal de la sección (h2) o de una fila dentro de otra. */
  as?: "h2" | "h3";
}

function ActionLink({ href, label, className, style }: { href: string; label: string; className?: string; style?: React.CSSProperties }) {
  return (
    <Link href={href} className={cn("shrink-0 hover:underline", className)} style={style}>
      {label}
    </Link>
  );
}

/** El título de una sección, como lo escribe cada estilo. */
export function SectionHeading({ ctx, title, subtitle, action, accent, as: Tag = "h2" }: HeadingProps) {
  if (!title && !subtitle && !action) return null;
  const accentDot = accent ? (
    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: "hsl(var(--brand-accent))" }} />
  ) : null;

  const h = ctx.headingLook;
  switch (h) {
    case "fashion":
    case "fashion-athletic":
    case "accessories": {
      const cls =
        h === "fashion"
          ? "text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground"
          : h === "accessories"
            ? "text-[11px] uppercase tracking-[0.3em] text-muted-foreground"
            : "text-[11px] font-medium uppercase tracking-[0.3em] text-foreground/50";
      return (
        <div className="mb-6 text-center">
          {title && <Tag className={cn("inline-flex items-center gap-2", cls)}>{accentDot}{title}</Tag>}
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          {action && (
            <div className="mt-2">
              <ActionLink href={action.href} label={action.label ?? "Ver todo"} className={cls} />
            </div>
          )}
        </div>
      );
    }
    case "fashion-streetwear":
      return (
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            {title && (
              <Tag className="flex items-center gap-3 text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">
                <span className="inline-block h-6 w-1.5" style={{ background: "hsl(var(--brand-accent))" }} />
                {title}
              </Tag>
            )}
            {subtitle && <p className="mt-1 pl-[18px] text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {action && (
            <ActionLink
              href={action.href}
              label={action.label ?? "Ver todo →"}
              className="text-xs font-extrabold uppercase tracking-widest"
              style={{ color: "hsl(var(--brand-accent))" }}
            />
          )}
        </div>
      );
    case "beauty-minimal":
      return (
        <div className="mb-8 text-center">
          {title && (
            <Tag className="inline-flex items-center gap-2 text-2xl tracking-tight sm:text-3xl" style={SERIF}>
              {accentDot}
              {title}
            </Tag>
          )}
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          {action && (
            <div className="mt-2">
              <ActionLink href={action.href} label={action.label ?? "Ver todo"} className="text-sm text-muted-foreground" />
            </div>
          )}
        </div>
      );
    case "sports-drops":
      return (
        <div className="mb-4">
          <div className="flex items-baseline justify-between gap-3">
            {title && (
              <Tag className="flex items-center gap-2 text-lg font-extrabold uppercase tracking-tight">
                {accentDot}
                {title}
              </Tag>
            )}
            {action && (
              <ActionLink
                href={action.href}
                label={action.label ?? "Ver todo"}
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: "hsl(var(--brand-accent))" }}
              />
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      );
    default: {
      const cls =
        h === "tech"
          ? "text-base font-bold uppercase tracking-wide"
          : h === "tech-discover"
            ? "text-base font-bold"
            : h === "sports"
              ? "text-lg font-extrabold uppercase italic tracking-wide"
              : h === "beauty"
                ? "text-lg font-semibold"
                : "text-lg font-bold tracking-tight";
      return (
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-3">
            {title && (
              <Tag className={cn("flex items-center gap-2", cls)}>
                {accentDot}
                {h === "beauty" && !accent && <Sparkles className="size-5 text-primary" />}
                {title}
              </Tag>
            )}
            {action && (
              <ActionLink href={action.href} label={action.label ?? "Ver todo"} className="text-sm font-medium text-primary" />
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      );
    }
  }
}

/** Una fila de tarjetas que se desliza con el dedo. */
export function ProductRow({ ctx, items }: { ctx: HomeContext; items: Product[] }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden">
      {items.map((p) => (
        <div key={p.id} className={lookRowItem(ctx.cardLook)}>
          <LookCard product={p} ctx={ctx} />
        </div>
      ))}
    </div>
  );
}

/** El marco de una sección: aire del estilo + contenedor centrado. */
export function Shell({
  ctx,
  children,
  className,
  style,
  id,
}: {
  ctx: HomeContext;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  return (
    <section id={id} className={cn(lookShell(ctx.look, ctx.density), className)} style={style}>
      <div className="container">{children}</div>
    </section>
  );
}

export { SERIF };
