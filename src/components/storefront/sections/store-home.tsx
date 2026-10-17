import { Fragment, type ReactNode } from "react";

import {
  AboutSection,
  BannerSection,
  BenefitsSection,
  CatalogSection,
  CategoriesSection,
  CollectionsSection,
  FaqSection,
  GallerySection,
  ImageTextSection,
  LocationsSection,
  LogosSection,
  ProductsSection,
  TestimonialsSection,
  WhatsappSection,
} from "@/components/storefront/sections/blocks";
import type { HomeContext } from "@/components/storefront/sections/context";
import { HeroSection } from "@/components/storefront/sections/hero";
import { SECTION_DEFS } from "@/lib/design/sections";
import type { AnySection, StoreDesign } from "@/lib/design/types";
import { rateInfo, type BcvReference } from "@/lib/exchange-rate";
import { storeHref } from "@/lib/store-href";
import type { Category, Product, Store } from "@/types/database";

/** Cada tipo de sección con su componente. `Record` completo: si falta uno, no compila. */
function renderSection(section: AnySection, ctx: HomeContext): ReactNode {
  switch (section.type) {
    case "hero":
      return <HeroSection section={section} ctx={ctx} />;
    case "benefits":
      return <BenefitsSection section={section} ctx={ctx} />;
    case "products":
      return <ProductsSection section={section} ctx={ctx} />;
    case "collections":
      return <CollectionsSection section={section} ctx={ctx} />;
    case "categories":
      return <CategoriesSection section={section} ctx={ctx} />;
    case "catalog":
      return <CatalogSection section={section} ctx={ctx} />;
    case "gallery":
      return <GallerySection section={section} ctx={ctx} />;
    case "logos":
      return <LogosSection section={section} ctx={ctx} />;
    case "testimonials":
      return <TestimonialsSection section={section} ctx={ctx} />;
    case "locations":
      return <LocationsSection section={section} ctx={ctx} />;
    case "about":
      return <AboutSection section={section} ctx={ctx} />;
    case "faq":
      return <FaqSection section={section} ctx={ctx} />;
    case "imageText":
      return <ImageTextSection section={section} ctx={ctx} />;
    case "banner":
      return <BannerSection section={section} ctx={ctx} />;
    case "whatsapp":
      return <WhatsappSection section={section} ctx={ctx} />;
  }
}

export interface StoreHomeProps {
  store: Store;
  design: StoreDesign;
  categories: Pick<Category, "id" | "name" | "slug">[];
  products: Product[];
  featured: Product[];
  hasFilters: boolean;
  heading: string;
  banner: string | null;
  /** La tasa del BCV, para rotular con su fecha valor la de la tienda si es esa. */
  bcv?: BcvReference | null;
  /** Vista previa del editor. */
  editing?: boolean;
}

/**
 * La página de inicio de la tienda armada desde las secciones del diseño.
 *
 * Con búsqueda o categoría activa se muestra solo el catálogo, igual que
 * hacían las plantillas: quien buscó algo quiere ver resultados, no la portada.
 */
export function StoreHome({
  store,
  design,
  categories,
  products,
  featured,
  hasFilters,
  heading,
  banner,
  bcv,
  editing = false,
}: StoreHomeProps) {
  const visible = design.home.filter((s) => !s.hidden);
  const rate = store.show_bs_prices
    ? rateInfo(store.exchange_rate, store.exchange_rate_updated_at, bcv)
    : null;

  const ctx: HomeContext = {
    store,
    look: design.tokens.look,
    cardLook: design.tokens.card ?? design.tokens.look,
    headingLook: design.tokens.heading ?? design.tokens.look,
    density: design.tokens.density ?? "normal",
    cardStyle: design.tokens.cardStyle,
    categories,
    categoryNames: new Map(categories.map((c) => [c.id, c.name])),
    products,
    featured,
    hasFilters,
    heading,
    banner,
    rateLabel: rate?.label ?? null,
    freeShipping: store.offers_delivery && Number(store.delivery_fee ?? 0) === 0,
    editing,
    hasCategoryNav: visible.some((s) => s.type === "categories") && categories.length > 0,
    link: (path = "") => storeHref(store.slug, path),
  };

  const sections = hasFilters ? visible.filter((s) => s.type === "catalog") : visible;
  // text-foreground explícito: sin esto el texto hereda el color del <body> (el
  // del panel, oscuro) y en una tienda de fondo oscuro quedaba oscuro sobre oscuro.
  const main = `text-foreground ${
    ctx.look === "classic" ? "pb-4" : ctx.look === "tech-discover" ? "pb-10" : "pb-6"
  }`;

  return (
    <main className={main}>
      {sections.map((s) =>
        editing ? (
          // La vista previa marca cada sección para poder elegirla con un clic.
          <div key={s.id} data-section-id={s.id} data-section-label={SECTION_DEFS[s.type].label}>
            {renderSection(s, ctx)}
          </div>
        ) : (
          <Fragment key={s.id}>{renderSection(s, ctx)}</Fragment>
        ),
      )}
    </main>
  );
}
