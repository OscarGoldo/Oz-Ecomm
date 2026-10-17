import Image from "next/image";
import Link from "next/link";
import {
  BadgeDollarSign,
  ChevronDown,
  MapPin,
  MessageCircle,
  PackageSearch,
  ShieldCheck,
  Star,
  Store as StoreIcon,
  Truck,
} from "lucide-react";

import { CategoryChips } from "@/components/storefront/category-chips";
import { SportsCategoryCarousel } from "@/components/storefront/sports-category-carousel";
import type { HomeContext } from "@/components/storefront/sections/context";
import { resolveLink } from "@/components/storefront/sections/hero";
import {
  LookCard,
  ProductRow,
  SERIF,
  SectionHeading,
  Shell,
  lookCentered,
  lookGrid,
} from "@/components/storefront/sections/look";
import type { Section } from "@/lib/design/types";
import { getImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { whatsappUrl } from "@/lib/whatsapp";
import type { Product } from "@/types/database";

/**
 * En la vista previa del editor, una sección que no tiene qué mostrar se ve
 * como un recuadro que explica por qué. En la tienda pública no aparece nada.
 */
export function Hint({ ctx, label, reason }: { ctx: HomeContext; label: string; reason: string }) {
  if (!ctx.editing) return null;
  return (
    <section className="container py-4">
      <div className="rounded-xl border-2 border-dashed border-foreground/20 p-4 text-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{label}:</span> {reason}
      </div>
    </section>
  );
}

const urls = (paths: string[]) =>
  paths.map((p) => getImageUrl(p)).filter((u): u is string => Boolean(u));

// ─── Productos ─────────────────────────────────────────────────────────────

const SET_RE = /\b(set|kit|combo|rutina|d[uú]o|tr[ií]o|pack)\b/i;

function productsFor(section: Section<"products">, ctx: HomeContext): Product[] {
  const s = section.settings;
  let items: Product[];
  switch (s.source) {
    case "destacados":
      items = ctx.featured;
      break;
    case "recientes":
      items = [...ctx.products].sort((a, b) => b.created_at.localeCompare(a.created_at));
      break;
    case "combos": {
      const sets = ctx.products.filter((p) => SET_RE.test(`${p.name} ${p.description ?? ""}`));
      items = sets.length ? sets : ctx.featured.length ? ctx.featured : ctx.products;
      break;
    }
    case "categoria": {
      const cat = ctx.categories.find((c) => c.slug === s.category);
      items = cat ? ctx.products.filter((p) => p.category_id === cat.id) : [];
      break;
    }
  }
  return items.slice(0, s.limit);
}

export function ProductsSection({ section, ctx }: { section: Section<"products">; ctx: HomeContext }) {
  const s = section.settings;
  const items = productsFor(section, ctx);
  if (items.length === 0) {
    const reason =
      s.source === "destacados"
        ? "marca productos como destacados para que aparezcan acá."
        : s.source === "categoria"
          ? s.category
            ? "esa categoría todavía no tiene productos."
            : "elige una categoría."
          : "todavía no hay productos para mostrar.";
    return <Hint ctx={ctx} label={s.title || "Productos"} reason={reason} />;
  }

  const action = s.viewAll
    ? { href: s.source === "categoria" && s.category ? ctx.link(`?cat=${s.category}`) : "#catalogo" }
    : undefined;
  const few = items.length <= 4;
  const grid = few
    ? cn("grid grid-cols-2 sm:grid-cols-4", ctx.cardLook === "beauty-minimal" ? "gap-x-5 gap-y-10" : "gap-3 sm:gap-4")
    : lookGrid(ctx.cardLook);

  const body = (
    <>
      <SectionHeading ctx={ctx} title={s.title} subtitle={s.subtitle} action={action} accent={s.accent} />
      {s.layout === "carrusel" ? (
        <ProductRow ctx={ctx} items={items} />
      ) : (
        <div className={grid}>
          {items.map((p) => (
            <LookCard key={p.id} product={p} ctx={ctx} />
          ))}
        </div>
      )}
    </>
  );

  return (
    <Shell ctx={ctx}>
      {ctx.look === "beauty" ? <div className="rounded-3xl bg-primary/5 p-5 sm:p-6">{body}</div> : body}
    </Shell>
  );
}

// ─── Colecciones (una fila por categoría) ──────────────────────────────────

export function CollectionsSection({ ctx }: { section: Section<"collections">; ctx: HomeContext }) {
  const rows = ctx.categories
    .map((cat) => ({ ...cat, items: ctx.products.filter((p) => p.category_id === cat.id).slice(0, 10) }))
    .filter((c) => c.items.length > 0);
  if (rows.length === 0) {
    return <Hint ctx={ctx} label="Colecciones" reason="crea categorías y ponles productos." />;
  }
  return (
    <>
      {rows.map((cat) => (
        <Shell key={cat.id} ctx={ctx}>
          <SectionHeading
            ctx={ctx}
            as="h3"
            title={cat.name}
            action={{ href: ctx.link(`?cat=${cat.slug}`) }}
          />
          <ProductRow ctx={ctx} items={cat.items} />
        </Shell>
      ))}
    </>
  );
}

// ─── Categorías ────────────────────────────────────────────────────────────

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function CategoriesSection({ section, ctx }: { section: Section<"categories">; ctx: HomeContext }) {
  const s = section.settings;
  if (ctx.categories.length === 0) {
    return <Hint ctx={ctx} label="Categorías" reason="todavía no creaste categorías." />;
  }
  const style =
    s.style !== "auto"
      ? s.style
      : ctx.look === "sports"
        ? "carrusel"
        : ctx.look === "sports-drops"
          ? "circulos"
          : "pastillas";

  if (style === "carrusel") {
    return (
      <section className="border-b-2 bg-card">
        <div className="container py-3">
          {s.title && <p className="mb-2 text-sm font-semibold">{s.title}</p>}
          <SportsCategoryCarousel categories={ctx.categories} />
        </div>
      </section>
    );
  }

  if (style === "circulos") {
    return (
      <section className="border-b border-foreground/10">
        <div className="container py-5">
          {s.title && <SectionHeading ctx={ctx} title={s.title} />}
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {ctx.categories.map((cat) => (
              <Link key={cat.id} href={ctx.link(`?cat=${cat.slug}`)} className="group flex w-20 shrink-0 flex-col items-center gap-2">
                <span
                  className="grid size-16 place-items-center rounded-full border-2 border-foreground/15 bg-foreground/5 text-lg font-extrabold transition-colors group-hover:border-[hsl(var(--brand-accent))]"
                  style={{ color: "hsl(var(--brand-accent))" }}
                >
                  {initials(cat.name)}
                </span>
                <span className="line-clamp-1 text-center text-[11px] font-bold uppercase tracking-wide text-foreground/70">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const centered = lookCentered(ctx.headingLook);
  return (
    <Shell ctx={ctx}>
      <SectionHeading ctx={ctx} title={s.title} />
      {centered ? (
        <div className="flex flex-wrap justify-center gap-2.5">
          {ctx.categories.map((cat) => (
            <Link
              key={cat.id}
              href={ctx.link(`?cat=${cat.slug}`)}
              className="rounded-full border border-foreground/15 px-5 py-2 text-sm font-medium transition-colors hover:bg-foreground hover:text-background"
            >
              {cat.name}
            </Link>
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <a href="#catalogo" className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Todas
          </a>
          {ctx.categories.map((c) => (
            <Link
              key={c.id}
              href={ctx.link(`?cat=${c.slug}`)}
              className="shrink-0 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Catálogo ──────────────────────────────────────────────────────────────

const EMPTY: Partial<Record<HomeContext["look"], { title: string; text: string }>> = {
  fashion: { title: "Colección en camino", text: "" },
  "fashion-athletic": { title: "Colección en camino", text: "" },
  accessories: { title: "Colección en camino", text: "" },
  "fashion-streetwear": { title: "Próximamente", text: "Se viene algo grande 👀" },
  "sports-drops": { title: "Próximo drop en camino", text: "Síguenos para no perderte el lanzamiento." },
};

export function CatalogSection({ section, ctx }: { section: Section<"catalog">; ctx: HomeContext }) {
  const title = ctx.hasFilters ? ctx.heading : section.settings.title;
  const empty = ctx.hasFilters
    ? { title: "Sin resultados", text: "Prueba con otra búsqueda o categoría." }
    : (EMPTY[ctx.look] ?? { title: "Catálogo en preparación", text: "Pronto vas a ver los productos aquí." });
  const showChips = ctx.hasFilters || !ctx.hasCategoryNav;

  return (
    <Shell ctx={ctx} id="catalogo" className="scroll-mt-20">
      {showChips && (
        <div className={cn("mb-4", lookCentered(ctx.headingLook) && "flex justify-center")}>
          <CategoryChips categories={ctx.categories} />
        </div>
      )}
      <SectionHeading ctx={ctx} title={title} />
      {ctx.products.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed p-12 text-center">
          <PackageSearch className="mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">{empty.title}</p>
          {empty.text && <p className="mt-1 text-sm text-muted-foreground">{empty.text}</p>}
        </div>
      ) : (
        <div className={lookGrid(ctx.cardLook)}>
          {ctx.products.map((p) => (
            <LookCard key={p.id} product={p} ctx={ctx} />
          ))}
        </div>
      )}
    </Shell>
  );
}

// ─── Galería y logos ───────────────────────────────────────────────────────

export function GallerySection({ section, ctx }: { section: Section<"gallery">; ctx: HomeContext }) {
  const s = section.settings;
  const own = urls(s.images);
  const images = own.length
    ? own
    : s.useProductPhotos
      ? ctx.products
          .map((p) => getImageUrl(p.images?.[0]))
          .filter((u): u is string => Boolean(u))
          .slice(0, 8)
      : [];
  if (images.length < 2) {
    return <Hint ctx={ctx} label={s.title || "Galería"} reason="sube al menos 2 fotos." />;
  }
  const mosaic = (s.style === "mosaico" || (s.style === "auto" && ctx.look === "fashion")) && images.length >= 4;

  return (
    <Shell ctx={ctx} className={ctx.look === "fashion-athletic" ? "bg-muted/40" : undefined}>
      <SectionHeading ctx={ctx} title={s.title} />
      {mosaic ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {images.slice(0, 7).map((img, i) => (
            <div
              key={i}
              className={cn(
                "relative overflow-hidden",
                i === 0 ? "col-span-2 row-span-2 aspect-square" : "aspect-square",
              )}
            >
              <Image src={img} alt="" fill sizes="(max-width: 640px) 50vw, 16vw" className="object-cover transition-transform duration-500 hover:scale-105" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {images.slice(0, 8).map((img, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-sm">
              <Image src={img} alt="" fill sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover transition-transform duration-500 hover:scale-105" />
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

export function LogosSection({ section, ctx }: { section: Section<"logos">; ctx: HomeContext }) {
  const logos = urls(section.settings.images);
  if (logos.length === 0) return <Hint ctx={ctx} label="Logos" reason="sube los logos." />;
  return (
    <Shell ctx={ctx}>
      <SectionHeading ctx={ctx} title={section.settings.title} />
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {logos.map((src, i) => (
          <div key={i} className="relative h-8 w-24 opacity-50 grayscale transition hover:opacity-100 hover:grayscale-0">
            <Image src={src} alt="" fill sizes="120px" className="object-contain" />
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Testimonios y locales ─────────────────────────────────────────────────

export function TestimonialsSection({ section, ctx }: { section: Section<"testimonials">; ctx: HomeContext }) {
  const s = section.settings;
  const items = s.items.filter((t) => t.quote.trim());
  if (items.length === 0) {
    return <Hint ctx={ctx} label={s.title || "Testimonios"} reason="agrega lo que dicen tus clientes." />;
  }

  if (ctx.look === "fashion-streetwear") {
    return (
      <section className="border-b bg-foreground py-12 text-background">
        <div className="container">
          <h2 className="mb-8 text-center text-2xl font-extrabold uppercase tracking-tight sm:text-3xl">{s.title}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((t, i) => (
              <figure key={i} className="border border-background/15 p-5">
                <div className="mb-2 flex gap-0.5" style={{ color: "hsl(var(--brand-accent))" }}>
                  {Array.from({ length: 5 }).map((_, n) => (
                    <Star key={n} className="size-4 fill-current" />
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed text-background/90">“{t.quote}”</blockquote>
                {t.author && (
                  <figcaption className="mt-3 text-xs font-extrabold uppercase tracking-widest text-background/60">
                    {t.author}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        </div>
      </section>
    );
  }

  const serif = ctx.look === "beauty-minimal";
  return (
    <Shell ctx={ctx} className={serif ? "bg-primary/5" : undefined}>
      <SectionHeading ctx={ctx} title={s.title} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <figure
            key={i}
            className={cn(
              "rounded-2xl p-6",
              serif ? "bg-background/70 text-center shadow-sm" : "border bg-card",
            )}
          >
            <blockquote
              className={cn("leading-relaxed text-foreground/80", serif ? "text-lg" : "text-sm")}
              style={serif ? SERIF : undefined}
            >
              “{t.quote}”
            </blockquote>
            {t.author && (
              <figcaption className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {t.author}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </Shell>
  );
}

export function LocationsSection({ section, ctx }: { section: Section<"locations">; ctx: HomeContext }) {
  const s = section.settings;
  const items = s.items.filter((l) => l.name.trim() || l.address.trim());
  if (items.length === 0) {
    return <Hint ctx={ctx} label={s.title || "Nuestras tiendas"} reason="agrega tus locales." />;
  }
  return (
    <Shell ctx={ctx}>
      <SectionHeading ctx={ctx} title={s.title} subtitle={s.subtitle} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((l, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border p-4">
            <MapPin className="mt-0.5 size-5 shrink-0" style={{ color: "hsl(var(--brand-accent))" }} />
            <div className="min-w-0">
              <p className="font-semibold">{l.name}</p>
              {l.address && <p className="text-sm text-muted-foreground">{l.address}</p>}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

// ─── Sobre nosotros ────────────────────────────────────────────────────────

export function AboutSection({ section, ctx }: { section: Section<"about">; ctx: HomeContext }) {
  const s = section.settings;
  const image = getImageUrl(s.image);
  const style =
    s.style !== "auto"
      ? s.style
      : ctx.look === "fashion-streetwear"
        ? "banda"
        : ctx.look === "sports-drops"
          ? "archivo"
          : ctx.look === "beauty-minimal"
            ? "dividido"
            : lookCentered(ctx.headingLook)
              ? "centrado"
              : "tarjeta";

  if (!s.text.trim() && !(style === "banda" && s.eyebrow)) {
    return <Hint ctx={ctx} label={s.title || "Sobre nosotros"} reason="escribe el texto." />;
  }
  const text = s.text && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{s.text}</p>;

  switch (style) {
    case "banda":
      return (
        <section
          className="py-16 text-center"
          style={{ background: "hsl(var(--brand-accent))", color: "hsl(var(--brand-accent-foreground))" }}
        >
          <div className="container mx-auto max-w-2xl">
            <h2 className="text-3xl font-extrabold uppercase tracking-tight sm:text-4xl">{s.title}</h2>
            {s.eyebrow && <p className="mt-2 text-sm font-bold uppercase tracking-[0.25em] opacity-80">{s.eyebrow}</p>}
            {s.text && <p className="mt-5 whitespace-pre-line leading-relaxed opacity-90">{s.text}</p>}
          </div>
        </section>
      );
    case "archivo":
      return (
        <section className="border-t border-foreground/10 bg-foreground/[0.02] py-14">
          <div className="container mx-auto max-w-2xl text-center">
            {s.eyebrow && (
              <p className="text-[11px] font-extrabold uppercase tracking-[0.3em]" style={{ color: "hsl(var(--brand-accent))" }}>
                {s.eyebrow}
              </p>
            )}
            <h2 className="mt-2 text-2xl font-extrabold uppercase">{s.title}</h2>
            <div className="mt-4">{text}</div>
          </div>
        </section>
      );
    case "dividido":
      return (
        <Shell ctx={ctx}>
          <div className={image ? "mx-auto grid max-w-4xl items-center gap-8 md:grid-cols-2" : "mx-auto max-w-2xl text-center"}>
            {image && (
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
                <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
              </div>
            )}
            <div className={image ? "text-left" : ""}>
              {s.eyebrow && <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">{s.eyebrow}</p>}
              <h2 className="text-2xl tracking-tight sm:text-3xl" style={SERIF}>
                {s.title}
              </h2>
              <p className="mt-4 whitespace-pre-line leading-relaxed text-foreground/70">{s.text}</p>
            </div>
          </div>
        </Shell>
      );
    case "centrado":
      return (
        <Shell ctx={ctx}>
          <div className="mx-auto max-w-2xl text-center">
            {s.eyebrow && <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">{s.eyebrow}</p>}
            <SectionHeading ctx={ctx} title={s.title} />
            {text}
          </div>
        </Shell>
      );
    case "tarjeta": {
      const card =
        ctx.look === "beauty"
          ? "rounded-3xl bg-primary/5 p-6 text-center"
          : ctx.look === "tech"
            ? "rounded-md border-2 bg-card p-6"
            : ctx.look === "sports"
              ? "rounded-lg border-2 bg-card p-6"
              : ctx.look === "tech-discover"
                ? "rounded-3xl bg-card p-6 shadow-sm"
                : "rounded-2xl border bg-card p-6";
      return (
        <Shell ctx={ctx}>
          <div className={card}>
            {s.eyebrow && <p className="mb-1 text-xs uppercase tracking-widest text-muted-foreground">{s.eyebrow}</p>}
            <SectionHeading ctx={ctx} title={s.title} />
            {text}
          </div>
        </Shell>
      );
    }
  }
}

// ─── Preguntas frecuentes ──────────────────────────────────────────────────

export function FaqSection({ section, ctx }: { section: Section<"faq">; ctx: HomeContext }) {
  const s = section.settings;
  const items = s.items.filter((i) => i.q.trim());
  if (items.length === 0) {
    return <Hint ctx={ctx} label={s.title || "Preguntas frecuentes"} reason="agrega las preguntas que más te hacen." />;
  }
  return (
    <Shell ctx={ctx}>
      <div className="mx-auto max-w-2xl">
        <SectionHeading ctx={ctx} title={s.title} />
        <div className="divide-y rounded-2xl border bg-card">
          {items.map((item, i) => (
            <details key={i} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              {item.a && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{item.a}</p>}
            </details>
          ))}
        </div>
      </div>
    </Shell>
  );
}

// ─── Imagen con texto, banner y WhatsApp ──────────────────────────────────

function CtaButton({ ctx, text, link, className, style }: { ctx: HomeContext; text: string; link: string; className?: string; style?: React.CSSProperties }) {
  if (!text.trim()) return null;
  return (
    <a
      href={resolveLink(ctx, link)}
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--radius)] px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90",
        className,
      )}
      style={style}
    >
      {text}
    </a>
  );
}

export function ImageTextSection({ section, ctx }: { section: Section<"imageText">; ctx: HomeContext }) {
  const s = section.settings;
  const image = getImageUrl(s.image);
  if (!image && !s.title && !s.text) {
    return <Hint ctx={ctx} label="Imagen con texto" reason="sube una foto y escribe el texto." />;
  }
  return (
    <Shell ctx={ctx}>
      <div className={cn("grid items-center gap-8", image && "md:grid-cols-2")}>
        {image && (
          <div className={cn("relative aspect-[4/3] overflow-hidden rounded-2xl", s.imageSide === "derecha" && "md:order-2")}>
            <Image src={image} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
          </div>
        )}
        <div>
          {s.title && (
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-heading, inherit)" }}>
              {s.title}
            </h2>
          )}
          {s.text && <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{s.text}</p>}
          <div className="mt-6">
            <CtaButton ctx={ctx} text={s.ctaText} link={s.ctaLink} className="bg-primary text-primary-foreground" />
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function BannerSection({ section, ctx }: { section: Section<"banner">; ctx: HomeContext }) {
  const s = section.settings;
  if (!s.title && !s.text) return <Hint ctx={ctx} label="Banner" reason="escribe el título de la promoción." />;
  const image = getImageUrl(s.image);
  const tone =
    s.tone === "acento"
      ? { background: "hsl(var(--brand-accent))", color: "hsl(var(--brand-accent-foreground))" }
      : s.tone === "oscuro"
        ? { background: "#0a0a0a", color: "#fafafa" }
        : { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" };
  return (
    <section className="container py-6">
      <div className="relative overflow-hidden rounded-3xl" style={image ? { color: "#fff" } : tone}>
        {image && (
          <>
            <Image src={image} alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        )}
        <div className="relative flex flex-col items-start gap-4 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div>
            {s.title && (
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ fontFamily: "var(--font-heading, inherit)" }}>
                {s.title}
              </h2>
            )}
            {s.text && <p className="mt-1 max-w-xl opacity-90">{s.text}</p>}
          </div>
          <CtaButton
            ctx={ctx}
            text={s.ctaText}
            link={s.ctaLink}
            className="shrink-0 bg-background text-foreground"
          />
        </div>
      </div>
    </section>
  );
}

export function WhatsappSection({ section, ctx }: { section: Section<"whatsapp">; ctx: HomeContext }) {
  const s = section.settings;
  const url = whatsappUrl(ctx.store.whatsapp, `Hola ${ctx.store.name}, quiero hacer una consulta.`);
  if (!url) return <Hint ctx={ctx} label="WhatsApp" reason="agrega tu WhatsApp en Ajustes." />;
  return (
    <section className="container py-8">
      <div className="flex flex-col items-center gap-4 rounded-3xl border bg-card p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-[#25D366]/15 text-[#128C7E]">
          <MessageCircle className="size-6" />
        </span>
        <div>
          {s.title && <h2 className="text-xl font-bold tracking-tight">{s.title}</h2>}
          {s.text && <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>}
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          <MessageCircle className="size-4" /> {s.ctaText || "Escríbenos por WhatsApp"}
        </a>
      </div>
    </section>
  );
}

// ─── Beneficios ────────────────────────────────────────────────────────────

export function BenefitsSection({ ctx }: { section: Section<"benefits">; ctx: HomeContext }) {
  const { store } = ctx;
  const benefits = [
    store.offers_delivery
      ? { icon: Truck, title: "Delivery", text: store.delivery_note || "Llevamos tu pedido" }
      : null,
    store.offers_pickup
      ? { icon: StoreIcon, title: "Retiro en tienda", text: "Busca tu pedido cuando quieras" }
      : null,
    { icon: BadgeDollarSign, title: "Precios en USD y Bs", text: "Pagas como te quede mejor" },
    { icon: ShieldCheck, title: "Compra segura", text: "Confirmas tu pago y recibes" },
  ].filter(Boolean) as { icon: typeof Truck; title: string; text: string }[];

  return (
    <section className="border-b bg-card">
      <div className="container grid grid-cols-2 gap-3 py-4 lg:grid-cols-4">
        {benefits.map((b) => (
          <div key={b.title} className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <b.icon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight">{b.title}</p>
              <p className="truncate text-xs text-muted-foreground">{b.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
