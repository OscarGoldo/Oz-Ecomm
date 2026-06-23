"use client";

import { ShoppingCart, Store as StoreIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatUSD } from "@/lib/format";
import { themeStyle, type SectionId, type StoreTheme } from "@/lib/theme";

export interface SampleProduct {
  name: string;
  price: number;
  image: string | null;
}

export function StorePreview({
  theme,
  storeName,
  logoUrl,
  products,
}: {
  theme: StoreTheme;
  storeName: string;
  logoUrl: string | null;
  products: SampleProduct[];
}) {
  const sample = products.length
    ? products
    : [
        { name: "Producto de ejemplo", price: 25, image: null },
        { name: "Otro producto", price: 40, image: null },
        { name: "Producto destacado", price: 15, image: null },
        { name: "Más productos", price: 60, image: null },
      ];

  const order: SectionId[] = theme.sections.includes("catalog")
    ? theme.sections
    : [...theme.sections, "catalog"];

  const fashion = theme.layout === "fashion";

  function Card({ p }: { p: SampleProduct }) {
    if (fashion) {
      return (
        <div>
          <div className="grid aspect-[3/4] place-items-center overflow-hidden bg-white text-muted-foreground">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <StoreIcon className="size-6 opacity-30" />
            )}
          </div>
          <div className="mt-1.5 text-center">
            <p className="line-clamp-1 text-[9px] uppercase tracking-[0.15em] text-foreground/80">
              {p.name}
            </p>
            <p className="text-[11px] font-bold">{formatUSD(p.price)}</p>
          </div>
        </div>
      );
    }
    return (
      <div
        className={cn(
          "overflow-hidden rounded-lg bg-card",
          theme.cardStyle === "bordered" ? "border-2" : "border shadow-sm",
        )}
      >
        <div className="grid aspect-square place-items-center bg-white text-muted-foreground">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.image} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <StoreIcon className="size-6 opacity-30" />
          )}
        </div>
        <div className="space-y-1.5 p-2">
          <p className="line-clamp-1 text-[11px] font-medium">{p.name}</p>
          <p className="text-xs font-bold">{formatUSD(p.price)}</p>
          <div className="grid h-6 place-items-center rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
            Agregar
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={themeStyle(theme)}
      className="overflow-hidden rounded-2xl border bg-background shadow-sm"
    >
      {theme.announcement.enabled && theme.announcement.text && (
        <div
          className="px-3 py-1.5 text-center text-[11px] font-medium text-white"
          style={{ background: "hsl(var(--brand-accent, var(--primary)))" }}
        >
          {theme.announcement.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b bg-background px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center overflow-hidden rounded-md bg-primary/10">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-7 object-cover" />
            ) : (
              <StoreIcon className="size-4 text-primary" />
            )}
          </span>
          <span className="text-sm font-semibold">{storeName}</span>
        </div>
        <ShoppingCart className="size-4 text-foreground" />
      </div>

      {/* Hero */}
      {fashion ? (
        <div className="flex min-h-[160px] items-end bg-gradient-to-br from-primary to-primary/70 p-4 text-white">
          <div>
            <p className="text-[8px] uppercase tracking-[0.3em] text-white/80">{storeName}</p>
            <p className="mt-1 text-lg font-light uppercase leading-tight tracking-wide">
              {theme.hero.headline || `Bienvenido a ${storeName}`}
            </p>
            <span className="mt-2 inline-block border border-white px-3 py-1 text-[9px] uppercase tracking-[0.2em]">
              {theme.hero.ctaText || "Ver colección"}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-primary to-primary/80 px-4 py-6 text-primary-foreground">
          <p className="text-base font-extrabold leading-tight">
            {theme.hero.headline || `Bienvenido a ${storeName}`}
          </p>
          {theme.hero.subtext && (
            <p className="mt-1 text-[11px] text-primary-foreground/90">{theme.hero.subtext}</p>
          )}
          <span className="mt-3 inline-block rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-primary">
            {theme.hero.ctaText || "Ver productos"}
          </span>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4 p-3">
        {order.map((id) => {
          if (id === "featured") {
            return (
              <div key="featured">
                <p className="mb-1.5 text-xs font-bold">Destacados</p>
                <div className="flex gap-2 overflow-hidden">
                  {sample.slice(0, 2).map((p, i) => (
                    <div key={i} className="w-24 shrink-0">
                      <Card p={p} />
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          if (id === "about") {
            if (!theme.about.text) return null;
            return (
              <div key="about" className="rounded-xl border bg-card p-3">
                <p className="text-xs font-bold">{theme.about.title}</p>
                <p className="mt-1 line-clamp-3 text-[11px] text-muted-foreground">
                  {theme.about.text}
                </p>
              </div>
            );
          }
          return (
            <div key="catalog">
              <p className="mb-1.5 text-xs font-bold">Catálogo</p>
              <div className="grid grid-cols-2 gap-2">
                {sample.slice(0, 4).map((p, i) => (
                  <Card key={i} p={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
