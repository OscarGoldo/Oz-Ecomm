import Image from "next/image";
import { ArrowRight, Truck, Wallet } from "lucide-react";

import { DropsCountdown } from "@/components/storefront/drops-countdown";
import { HeroSlides } from "@/components/storefront/hero-slides";
import { StoreSearch } from "@/components/storefront/store-search";
import type { HomeContext } from "@/components/storefront/sections/context";
import type { HeroStyle, LookId, Section } from "@/lib/design/types";
import { getImageUrl } from "@/lib/storage";

const SERIF = { fontFamily: "var(--font-heading, var(--font-lora))" } as const;

/** La portada que trae cada estilo cuando el comerciante no eligió otra. */
const LOOK_HERO: Record<LookId, Exclude<HeroStyle, "auto">> = {
  classic: "clasico",
  fashion: "editorial",
  "fashion-athletic": "atleta",
  "fashion-streetwear": "urbano",
  accessories: "minimal",
  beauty: "suave",
  "beauty-minimal": "dividido",
  tech: "buscador",
  "tech-discover": "promo",
  sports: "energetico",
  "sports-drops": "campana",
};

export function heroStyleFor(style: HeroStyle, look: LookId): Exclude<HeroStyle, "auto"> {
  return style === "auto" ? LOOK_HERO[look] : style;
}

/**
 * A dónde lleva un botón que configuró el comerciante. Vacío baja al catálogo;
 * "?cat=x" o "/producto/y" son de la tienda; un enlace completo va tal cual.
 */
export function resolveLink(ctx: HomeContext, link: string): string {
  const l = link.trim();
  if (!l) return "#catalogo";
  if (/^https?:\/\//i.test(l) || l.startsWith("#")) return l;
  if (l.startsWith("?") || l.startsWith("/")) return ctx.link(l);
  return ctx.link(`/${l}`);
}

const urls = (paths: string[]) =>
  paths.map((p) => getImageUrl(p)).filter((u): u is string => Boolean(u));

export function HeroSection({ section, ctx }: { section: Section<"hero">; ctx: HomeContext }) {
  const s = section.settings;
  const { store } = ctx;
  const style = heroStyleFor(s.style, ctx.look);
  const headline = s.headline || store.description || `Bienvenido a ${store.name}`;
  const subtext = s.subtext;
  const cta = s.ctaText || "Ver productos";
  const href = resolveLink(ctx, s.ctaLink);
  const slides = urls(s.images);
  const banner = ctx.banner;
  const eyebrow = s.showStoreName ? store.name : null;

  switch (style) {
    case "clasico": {
      const image = slides[0] ?? banner;
      return image ? (
        <section className="relative h-44 w-full sm:h-64">
          {slides.length > 1 ? (
            <HeroSlides slides={slides} alt={store.name} />
          ) : (
            <Image src={image} alt={store.name} fill priority className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="container relative flex h-full flex-col justify-end pb-5 text-white">
            <h1 className="text-2xl font-extrabold sm:text-4xl">{headline}</h1>
            {(subtext || store.description) && (
              <p className="max-w-lg text-sm text-white/90">{subtext || store.description}</p>
            )}
          </div>
        </section>
      ) : (
        <section className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
          <div className="container py-10 sm:py-14">
            {s.showStoreName && store.address && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary-foreground/80">
                {store.address}
              </p>
            )}
            <h1 className="max-w-2xl text-2xl font-extrabold leading-tight sm:text-4xl">{headline}</h1>
            {subtext && <p className="mt-2 max-w-lg text-primary-foreground/90">{subtext}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href={href}
                className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary shadow-sm transition-opacity hover:opacity-90"
              >
                {cta}
              </a>
              {ctx.rateLabel && <span className="text-sm text-primary-foreground/90">{ctx.rateLabel}</span>}
            </div>
          </div>
        </section>
      );
    }

    case "editorial":
      return (
        <section className="relative flex min-h-[78vh] items-end overflow-hidden">
          {slides.length || banner ? (
            <HeroSlides slides={slides} fallback={banner} alt={store.name} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70" />
          )}
          <div className="absolute inset-0 bg-black/30" />
          <div className="container relative pb-12 text-white sm:pb-16">
            {eyebrow && (
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-white/80">{eyebrow}</p>
            )}
            <h1 className="max-w-2xl text-4xl font-light uppercase leading-[1.05] tracking-wide sm:text-6xl">
              {headline}
            </h1>
            {subtext && <p className="mt-4 max-w-md text-sm text-white/85">{subtext}</p>}
            <a
              href={href}
              className="mt-7 inline-block border border-white px-8 py-3 text-xs font-medium uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-black"
            >
              {cta}
            </a>
          </div>
        </section>
      );

    case "atleta":
      return (
        <section className="relative flex min-h-[85vh] items-end overflow-hidden">
          {slides.length || banner ? (
            <HeroSlides slides={slides} fallback={banner} alt={store.name} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-stone-800 to-stone-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          <div className="container relative pb-14 text-white sm:pb-20">
            {eyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/60">{eyebrow}</p>
            )}
            <h1 className="mt-2 max-w-xl text-3xl font-light leading-[1.1] sm:text-5xl">{headline}</h1>
            {subtext && <p className="mt-4 max-w-sm text-sm font-light text-white/75">{subtext}</p>}
            <a
              href={href}
              className="mt-8 inline-block border border-white/80 px-8 py-3 text-[11px] font-medium uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-stone-900"
            >
              {cta}
            </a>
          </div>
        </section>
      );

    case "urbano": {
      const video = s.videoUrl.trim();
      return (
        <section className="relative flex min-h-[78vh] items-end overflow-hidden bg-foreground">
          {video ? (
            <video className="absolute inset-0 h-full w-full object-cover" src={video} autoPlay muted loop playsInline />
          ) : slides.length || banner ? (
            <HeroSlides slides={slides} fallback={banner} alt={store.name} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-foreground to-foreground/70" />
          )}
          <div className="absolute inset-0 bg-black/35" />
          <div className="container relative pb-12 text-white sm:pb-16">
            {eyebrow && (
              <p className="text-xs font-extrabold uppercase tracking-[0.3em] text-white/70">{eyebrow}</p>
            )}
            <h1 className="mt-2 max-w-2xl text-4xl font-extrabold uppercase leading-[0.95] sm:text-6xl">
              {headline}
            </h1>
            {subtext && <p className="mt-3 max-w-md text-sm text-white/85">{subtext}</p>}
            <a
              href={href}
              className="mt-7 inline-block px-9 py-3.5 text-sm font-extrabold uppercase tracking-widest transition-transform hover:scale-105"
              style={{
                background: "hsl(var(--brand-accent))",
                color: "hsl(var(--brand-accent-foreground))",
              }}
            >
              {cta}
            </a>
          </div>
        </section>
      );
    }

    case "minimal":
      return (
        <section className="border-b">
          <div className="container py-16 text-center sm:py-24">
            {eyebrow && (
              <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">{eyebrow}</p>
            )}
            <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-normal leading-tight sm:text-5xl">{headline}</h1>
            {subtext && <p className="mx-auto mt-5 max-w-md text-sm text-muted-foreground">{subtext}</p>}
            <a
              href={href}
              className="mt-8 inline-block border-b-2 border-foreground pb-1 text-xs uppercase tracking-[0.2em] transition-colors hover:border-primary hover:text-primary"
            >
              {cta}
            </a>
          </div>
        </section>
      );

    case "suave":
      return (
        <section className="bg-gradient-to-b from-primary/10 to-transparent">
          <div className="container py-12 text-center sm:py-16">
            {eyebrow && (
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">{eyebrow}</p>
            )}
            <h1 className="mx-auto max-w-xl text-3xl font-semibold leading-tight sm:text-4xl">{headline}</h1>
            {subtext && <p className="mx-auto mt-3 max-w-md text-muted-foreground">{subtext}</p>}
            <a
              href={href}
              className="mt-6 inline-block rounded-full bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              {cta}
            </a>
          </div>
        </section>
      );

    case "dividido": {
      const fallback =
        banner ??
        getImageUrl(ctx.featured[0]?.images?.[0]) ??
        getImageUrl(ctx.products[0]?.images?.[0]);
      const hasImage = slides.length > 0 || Boolean(fallback);
      return (
        <section className="bg-gradient-to-b from-primary/10 to-background">
          <div className="container grid items-center gap-8 py-12 md:grid-cols-2 md:py-16">
            <div className="order-2 md:order-1">
              {eyebrow && (
                <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{eyebrow}</p>
              )}
              <h1 className="mt-3 text-4xl leading-[1.1] tracking-tight sm:text-5xl" style={SERIF}>
                {headline}
              </h1>
              {subtext && <p className="mt-4 max-w-md text-foreground/70">{subtext}</p>}
              <a
                href={href}
                className="mt-7 inline-block rounded-full bg-foreground px-8 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                {cta}
              </a>
            </div>
            {hasImage && (
              <div className="relative order-1 aspect-[4/5] overflow-hidden rounded-3xl bg-muted md:order-2">
                <HeroSlides
                  slides={slides}
                  fallback={fallback}
                  alt={store.name}
                  imageClassName={slides.length ? "object-cover" : "object-contain p-8"}
                />
              </div>
            )}
          </div>
        </section>
      );
    }

    case "buscador":
      return (
        <section className="bg-[#0b1220] text-white">
          <div className="container py-7 sm:py-10">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{eyebrow}</p>
            )}
            <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{headline}</h1>
            {subtext && <p className="mt-1 text-sm text-white/70">{subtext}</p>}
            <div className="mt-5 max-w-2xl">
              <StoreSearch store={store} placeholder="Buscar productos, marcas, modelos…" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {ctx.freeShipping && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                  <Truck className="size-4" /> Envío gratis
                </span>
              )}
              {store.show_bs_prices && store.exchange_rate && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                  <Wallet className="size-4" /> Precios en USD y Bs
                </span>
              )}
            </div>
          </div>
        </section>
      );

    case "promo": {
      const promoImg =
        slides[0] ??
        banner ??
        getImageUrl(ctx.featured[0]?.images?.[0]) ??
        getImageUrl(ctx.products[0]?.images?.[0]);
      return (
        <section className="container pt-5">
          <div className="overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-sm">
            <div className="flex items-center">
              <div className="flex-1 p-5 sm:p-8">
                {eyebrow && (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground/70">
                    {eyebrow}
                  </p>
                )}
                <h1 className="max-w-md text-2xl font-bold leading-tight sm:text-3xl">{headline}</h1>
                {subtext && (
                  <span className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">
                    {subtext}
                  </span>
                )}
                <div className="mt-4">
                  <a
                    href={href}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/30"
                  >
                    {cta} <ArrowRight className="size-4" />
                  </a>
                </div>
              </div>
              {promoImg && (
                <div className="relative h-36 w-32 shrink-0 self-end sm:h-48 sm:w-56">
                  <Image
                    src={promoImg}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 128px, 224px"
                    className="object-contain object-bottom p-2 drop-shadow-xl"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    case "energetico":
      return (
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          {(slides[0] ?? banner) && (
            <Image src={(slides[0] ?? banner)!} alt={store.name} fill priority className="object-cover opacity-25" />
          )}
          <div className="absolute inset-y-0 right-0 hidden w-1/3 -skew-x-12 bg-foreground/15 sm:block" />
          <div className="container relative py-10 sm:py-14">
            {eyebrow && (
              <p className="text-xs font-extrabold uppercase tracking-[0.25em] text-primary-foreground/70">{eyebrow}</p>
            )}
            <h1 className="mt-1 max-w-2xl text-3xl font-extrabold uppercase italic leading-[0.95] sm:text-5xl">
              {headline}
            </h1>
            {subtext && <p className="mt-3 max-w-md font-medium text-primary-foreground/90">{subtext}</p>}
            <a
              href={href}
              className="mt-6 inline-block -skew-x-6 bg-foreground px-8 py-3 text-sm font-extrabold uppercase italic tracking-wide text-background transition-transform hover:scale-105"
            >
              {cta}
            </a>
          </div>
        </section>
      );

    case "campana":
      return (
        <section className="relative overflow-hidden border-b border-white/10 bg-black">
          {slides.length || banner ? (
            <HeroSlides slides={slides} fallback={banner} alt={store.name} imageClassName="object-cover opacity-40" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-black" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
          <div className="container relative py-14 sm:py-20">
            {eyebrow && (
              <p className="text-xs font-extrabold uppercase tracking-[0.3em]" style={{ color: "hsl(var(--brand-accent))" }}>
                {eyebrow} · Drop activo
              </p>
            )}
            <h1 className="mt-2 max-w-2xl text-4xl font-extrabold uppercase leading-[0.95] text-white sm:text-6xl">
              {headline}
            </h1>
            {subtext && <p className="mt-3 max-w-md text-sm text-white/70">{subtext}</p>}
            <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
              <a
                href={href}
                className="inline-block w-fit rounded-md px-8 py-3 text-sm font-extrabold uppercase tracking-wide transition-transform hover:scale-105"
                style={{
                  background: "hsl(var(--brand-accent))",
                  color: "hsl(var(--brand-accent-foreground))",
                }}
              >
                {cta}
              </a>
              {s.countdown && (
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-white/50">
                    El drop termina en
                  </p>
                  <DropsCountdown />
                </div>
              )}
            </div>
          </div>
        </section>
      );
  }
}
