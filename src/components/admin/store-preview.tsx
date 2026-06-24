"use client";

import { Search, ShoppingCart, Store as StoreIcon } from "lucide-react";

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
  const tech = theme.layout === "tech";
  const sports = theme.layout === "sports";
  const accessories = theme.layout === "accessories";
  const beauty = theme.layout === "beauty";

  function Card({ p }: { p: SampleProduct }) {
    if (accessories) {
      return (
        <div className="text-center">
          <div className="grid aspect-square place-items-center rounded-sm bg-muted/40 text-muted-foreground">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-contain p-3" />
            ) : (
              <StoreIcon className="size-5 opacity-30" />
            )}
          </div>
          <p className="mt-2 line-clamp-1 text-[8px] uppercase tracking-[0.15em] text-foreground/70">
            {p.name}
          </p>
          <p className="text-[10px] font-bold">{formatUSD(p.price)}</p>
        </div>
      );
    }
    if (beauty) {
      return (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="grid aspect-square place-items-center bg-white text-muted-foreground">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <StoreIcon className="size-5 opacity-30" />
            )}
          </div>
          <div className="space-y-1 p-2">
            <p className="line-clamp-1 text-[9px] font-medium">{p.name}</p>
            <p className="text-[8px] text-amber-400">
              ★★★★★ <span className="text-muted-foreground">(12)</span>
            </p>
            <p className="text-[10px] font-bold">{formatUSD(p.price)}</p>
            <div className="grid h-5 place-items-center rounded-full bg-primary text-[8px] font-semibold text-primary-foreground">
              Agregar
            </div>
          </div>
        </div>
      );
    }
    if (sports) {
      return (
        <div className="overflow-hidden rounded-lg border-2 bg-card">
          <div className="relative grid aspect-square place-items-center bg-white text-muted-foreground">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <StoreIcon className="size-5 opacity-30" />
            )}
            <span className="absolute -left-1 top-1.5 -skew-x-12 bg-primary px-2 py-0.5 text-[8px] font-extrabold uppercase italic text-primary-foreground">
              -20%
            </span>
          </div>
          <div className="space-y-1 p-1.5">
            <p className="line-clamp-1 text-[9px] font-bold uppercase">{p.name}</p>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 bg-destructive" />
            </div>
            <p className="text-[7px] font-extrabold uppercase italic text-destructive">
              ¡Solo quedan 3!
            </p>
            <p className="text-[10px] font-bold">{formatUSD(p.price)}</p>
            <div className="grid h-5 place-items-center rounded-sm bg-primary text-[8px] font-bold uppercase text-primary-foreground">
              Agregar
            </div>
          </div>
        </div>
      );
    }
    if (tech) {
      return (
        <div className="overflow-hidden rounded border-2 bg-card">
          <div className="grid aspect-square place-items-center bg-white text-muted-foreground">
            {p.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <StoreIcon className="size-5 opacity-30" />
            )}
          </div>
          <div className="space-y-1 p-1.5">
            <p className="line-clamp-1 text-[9px] font-semibold">{p.name}</p>
            <div className="flex gap-0.5">
              <span className="rounded-sm border px-1 text-[7px] text-muted-foreground">USB</span>
              <span className="rounded-sm border px-1 text-[7px] text-muted-foreground">LED</span>
            </div>
            <p className="text-[10px] font-bold">{formatUSD(p.price)}</p>
            <div className="grid h-5 place-items-center rounded-sm bg-primary text-[8px] font-semibold text-primary-foreground">
              Agregar
            </div>
          </div>
        </div>
      );
    }
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
      {accessories ? (
        <div className="border-b bg-background px-4 py-6 text-center">
          <p className="text-[7px] uppercase tracking-[0.3em] text-muted-foreground">
            {storeName}
          </p>
          <p className="mt-1 text-sm">
            {theme.hero.headline || `Bienvenido a ${storeName}`}
          </p>
          <span className="mt-2 inline-block border-b border-foreground pb-0.5 text-[8px] uppercase tracking-[0.2em]">
            {theme.hero.ctaText || "Ver colección"}
          </span>
        </div>
      ) : beauty ? (
        <div className="bg-gradient-to-b from-primary/15 to-transparent px-4 py-6 text-center">
          <p className="text-sm font-semibold">
            {theme.hero.headline || `Bienvenido a ${storeName}`}
          </p>
          <span className="mt-2 inline-block rounded-full bg-primary px-3 py-1 text-[8px] font-semibold text-primary-foreground">
            {theme.hero.ctaText || "Comprar"}
          </span>
        </div>
      ) : sports ? (
        <div className="relative overflow-hidden bg-primary p-4 text-primary-foreground">
          <div className="absolute inset-y-0 right-0 w-1/3 -skew-x-12 bg-foreground/15" />
          <p className="relative text-[8px] font-extrabold uppercase tracking-widest text-primary-foreground/70">
            {storeName}
          </p>
          <p className="relative mt-0.5 text-sm font-extrabold uppercase italic">
            {theme.hero.headline || `Bienvenido a ${storeName}`}
          </p>
          <span className="relative mt-2 inline-block -skew-x-6 bg-foreground px-2 py-0.5 text-[8px] font-extrabold uppercase italic text-background">
            {theme.hero.ctaText || "Comprar"}
          </span>
        </div>
      ) : tech ? (
        <div className="bg-[#0b1220] p-4 text-white">
          <p className="text-[8px] font-semibold uppercase tracking-[0.2em] text-white/50">
            {storeName}
          </p>
          <p className="mt-0.5 text-sm font-bold">
            {theme.hero.headline || `Bienvenido a ${storeName}`}
          </p>
          <div className="mt-2 flex items-center gap-1.5 rounded bg-white px-2 py-1.5">
            <Search className="size-3 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Buscar productos…</span>
          </div>
          <span className="mt-2 inline-block rounded bg-primary px-2 py-0.5 text-[8px] font-bold uppercase text-primary-foreground">
            Envío gratis
          </span>
        </div>
      ) : fashion ? (
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
