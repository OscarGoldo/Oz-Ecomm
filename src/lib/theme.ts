import type { CSSProperties } from "react";

import { hexToHslTriplet, isDarkColor } from "@/lib/color";
import type { Store } from "@/types/database";

export type ThemeFont = "inter" | "poppins" | "montserrat" | "lora";
export type ButtonStyle = "rounded" | "square";
export type CardStyle = "soft" | "bordered";
export type SectionId = "featured" | "catalog" | "about";

/** Structural layout variant per vertical (changes the JSX, not just styles). */
export type LayoutId =
  | "classic"
  | "fashion"
  | "fashion-athletic"
  | "fashion-streetwear"
  | "accessories"
  | "beauty"
  | "beauty-minimal"
  | "tech"
  | "tech-discover"
  | "sports"
  | "sports-drops";

export const LAYOUT_IDS: LayoutId[] = [
  "classic",
  "fashion",
  "fashion-athletic",
  "fashion-streetwear",
  "accessories",
  "beauty",
  "beauty-minimal",
  "tech",
  "tech-discover",
  "sports",
  "sports-drops",
];

/** A configurable home section (Shopify-style block). */
export interface ThemeBlock {
  enabled: boolean;
  title: string;
  subtitle: string;
}

/** A customer testimonial / story (Belleza Minimal, Streetwear). */
export interface Testimonial {
  quote: string;
  author: string;
}

/** A physical store location (Streetwear). */
export interface Location {
  name: string;
  address: string;
}

/** Owner-uploaded image sets for the design (storage paths). */
export interface ThemeMedia {
  /** Hero carousel slides (falls back to the single banner if empty). */
  heroSlides: string[];
  /** Lifestyle / lookbook gallery (falls back to product images if empty). */
  gallery: string[];
  /** Press / brand logos strip. */
  pressLogos: string[];
}

export interface StoreTheme {
  preset: string;
  /** Structural layout. "classic" = base layout. */
  layout: LayoutId;
  colors: { primary: string; accent: string; surface: string };
  font: ThemeFont;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
  announcement: { enabled: boolean; text: string };
  hero: { headline: string; subtext: string; ctaText: string };
  about: { title: string; text: string };
  sections: SectionId[];
  /** Per-block content/visibility (keyed by block id). */
  blocks: Record<string, ThemeBlock>;
  /** Order of the reorderable blocks for the current layout. */
  blockOrder: string[];
  /** Owner-uploaded images. */
  media: ThemeMedia;
  /** Customer stories (used by layouts that show testimonials). */
  testimonials: Testimonial[];
  /** Physical store locations (used by layouts that show a store list). */
  locations: Location[];
  /** Optional hero video URL (.mp4/.webm) for layouts that support it. */
  heroVideoUrl: string;
}

export type MediaKey = keyof ThemeMedia;

/** Which media uploaders each layout exposes, with editor labels/limits. */
export const LAYOUT_MEDIA: Partial<
  Record<LayoutId, { key: MediaKey; label: string; help: string; max: number }[]>
> = {
  "fashion-athletic": [
    { key: "heroSlides", label: "Carrusel de portada", help: "Imágenes grandes que rotan en el hero.", max: 5 },
    { key: "gallery", label: "Galería “En acción”", help: "Fotos lifestyle. Si está vacía, se usan fotos de productos.", max: 8 },
    { key: "pressLogos", label: "Logos de prensa", help: "Logos de medios o marcas (se muestran en gris).", max: 8 },
  ],
  "fashion-streetwear": [
    { key: "heroSlides", label: "Carrusel de portada", help: "Imágenes grandes que rotan en el hero.", max: 5 },
    { key: "gallery", label: "Galería lifestyle", help: "Se muestra como una franja de fotos.", max: 8 },
  ],
  "sports-drops": [
    { key: "heroSlides", label: "Carrusel de campaña", help: "Imágenes de la campaña/drop que rotan en el hero.", max: 5 },
  ],
  "beauty-minimal": [
    { key: "heroSlides", label: "Imagen de portada", help: "Producto o lanzamiento destacado del hero (podés poner varias y rotan).", max: 4 },
    { key: "gallery", label: "Galería “Get the look”", help: "Fotos para combinar el look. Opcional.", max: 6 },
  ],
  "tech-discover": [
    { key: "heroSlides", label: "Imagen del banner", help: "Foto del producto o promo que aparece en el banner de arriba (fondo transparente queda mejor).", max: 4 },
  ],
};

/** Definition of a configurable block, per layout. */
export interface LayoutBlockDef {
  id: string;
  label: string;
  defaultTitle: string;
  defaultSubtitle?: string;
  /** Which editable text fields to expose in the editor. */
  fields: Array<"title" | "subtitle" | "body">;
  /** Can be turned off by the owner. */
  removable: boolean;
  /** Participates in section ordering. */
  reorderable: boolean;
}

/**
 * Section catalog per layout. Only layouts listed here use the section
 * builder; others fall back to the legacy "sections" control.
 */
export const LAYOUT_BLOCKS: Partial<Record<LayoutId, LayoutBlockDef[]>> = {
  "fashion-athletic": [
    { id: "lo-nuevo", label: "Lo nuevo (destacados)", defaultTitle: "Lo nuevo", fields: ["title"], removable: true, reorderable: true },
    { id: "catalog", label: "Catálogo", defaultTitle: "Colección", fields: ["title"], removable: false, reorderable: true },
    { id: "lifestyle", label: "En acción (galería)", defaultTitle: "En acción", fields: ["title"], removable: true, reorderable: true },
    { id: "prensa", label: "Prensa (logos)", defaultTitle: "Nos recomiendan", fields: ["title"], removable: true, reorderable: true },
    { id: "about", label: "Sobre la marca", defaultTitle: "Sobre nosotros", fields: ["title", "body"], removable: true, reorderable: true },
  ],
  "fashion-streetwear": [
    { id: "lo-nuevo", label: "New in (destacados)", defaultTitle: "New in", defaultSubtitle: "Lo último que llegó 🔥", fields: ["title", "subtitle"], removable: true, reorderable: true },
    { id: "colecciones", label: "Colecciones / drops", defaultTitle: "Colecciones", fields: ["title"], removable: true, reorderable: true },
    { id: "galeria", label: "Galería lifestyle", defaultTitle: "El look", fields: ["title"], removable: true, reorderable: true },
    { id: "catalog", label: "Catálogo", defaultTitle: "Toda la tienda", fields: ["title"], removable: false, reorderable: true },
    { id: "testimonios", label: "Reseñas de clientes", defaultTitle: "Lo que dicen de nosotros", fields: ["title"], removable: true, reorderable: true },
    { id: "locales", label: "Nuestras tiendas", defaultTitle: "Nuestras tiendas", defaultSubtitle: "Vení a conocernos", fields: ["title", "subtitle"], removable: true, reorderable: true },
    { id: "marca", label: "Sobre la marca", defaultTitle: "La marca", defaultSubtitle: "Est. 2017 · Caracas", fields: ["title", "subtitle", "body"], removable: true, reorderable: true },
  ],
  "beauty-minimal": [
    { id: "categorias", label: "Navegación por tipo", defaultTitle: "Comprá por categoría", fields: ["title"], removable: true, reorderable: true },
    { id: "shop-all", label: "Shop All (best sellers)", defaultTitle: "Lo más querido", defaultSubtitle: "Los favoritos de la casa", fields: ["title", "subtitle"], removable: true, reorderable: true },
    { id: "get-the-look", label: "Get the look (sets/combos)", defaultTitle: "Get the look", defaultSubtitle: "Combiná tus esenciales", fields: ["title", "subtitle"], removable: true, reorderable: true },
    { id: "catalog", label: "Catálogo", defaultTitle: "Todo", fields: ["title"], removable: false, reorderable: true },
    { id: "testimonios", label: "Historias reales", defaultTitle: "Historias reales", fields: ["title"], removable: true, reorderable: true },
    { id: "historia", label: "Manifiesto de marca", defaultTitle: "Nuestra historia", fields: ["title", "body"], removable: true, reorderable: true },
  ],
  "tech-discover": [
    { id: "promo", label: "Banner de promo", defaultTitle: "", fields: [], removable: true, reorderable: true },
    { id: "categorias", label: "Categorías (pills)", defaultTitle: "Categorías", fields: ["title"], removable: true, reorderable: true },
    { id: "destacados", label: "Destacados", defaultTitle: "Lo más vendido", fields: ["title"], removable: true, reorderable: true },
    { id: "catalog", label: "Catálogo", defaultTitle: "Todos los productos", fields: ["title"], removable: false, reorderable: true },
    { id: "about", label: "Sobre la tienda", defaultTitle: "Sobre nosotros", fields: ["title", "body"], removable: true, reorderable: true },
  ],
  "sports-drops": [
    { id: "ligas", label: "Navegación por categorías", defaultTitle: "Categorías", fields: [], removable: true, reorderable: true },
    { id: "recien", label: "Recién agregados", defaultTitle: "Recién agregados", fields: ["title"], removable: true, reorderable: true },
    { id: "mas-vendidos", label: "Más vendidos (destacados)", defaultTitle: "Más vendidos", fields: ["title"], removable: true, reorderable: true },
    { id: "colecciones", label: "Colecciones por categoría", defaultTitle: "Colecciones", fields: ["title"], removable: true, reorderable: true },
    { id: "catalog", label: "Catálogo", defaultTitle: "Todos los drops", fields: ["title"], removable: false, reorderable: true },
    { id: "archivo", label: "El archivo (historia)", defaultTitle: "El archivo", fields: ["title", "body"], removable: true, reorderable: true },
    { id: "countdown", label: "Contador en el hero", defaultTitle: "", fields: [], removable: true, reorderable: false },
  ],
};

export const THEME_FONTS: { id: ThemeFont; label: string; cssVar: string }[] = [
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)" },
  { id: "poppins", label: "Poppins", cssVar: "var(--font-poppins)" },
  { id: "montserrat", label: "Montserrat", cssVar: "var(--font-montserrat)" },
  { id: "lora", label: "Lora (serif)", cssVar: "var(--font-lora)" },
];

export const SECTION_LABELS: Record<SectionId, string> = {
  featured: "Productos destacados",
  catalog: "Catálogo",
  about: "Sobre la tienda",
};

export const DEFAULT_THEME: StoreTheme = {
  preset: "classic",
  layout: "classic",
  colors: { primary: "#2563EB", accent: "#f59e0b", surface: "#ffffff" },
  font: "inter",
  buttonStyle: "rounded",
  cardStyle: "soft",
  announcement: { enabled: false, text: "" },
  hero: { headline: "", subtext: "", ctaText: "" },
  about: { title: "Sobre nosotros", text: "" },
  sections: ["featured", "catalog"],
  blocks: {},
  blockOrder: [],
  media: { heroSlides: [], gallery: [], pressLogos: [] },
  testimonials: [],
  locations: [],
  heroVideoUrl: "",
};

/** Layouts that expose a hero video URL field in the editor. */
export const LAYOUT_HERO_VIDEO: LayoutId[] = ["fashion-streetwear"];

/** Template categories: the picker groups presets under these. */
export const TEMPLATE_CATEGORIES: { id: string; label: string }[] = [
  { id: "classic", label: "Clásico" },
  { id: "fashion", label: "Moda" },
  { id: "accessories", label: "Accesorios" },
  { id: "beauty", label: "Belleza" },
  { id: "tech", label: "Tecnología" },
  { id: "sports", label: "Deportes" },
  // Próximas: "Estilo de Vida y Hogar" y "Librería" (cuando tengan plantillas).
];

export const THEME_PRESETS: {
  id: string;
  label: string;
  desc: string;
  icon: string;
  /** Picker grouping (TEMPLATE_CATEGORIES id). */
  category: string;
  /** The category's base template. */
  standard?: boolean;
  /** Reference site this template is inspired by. */
  inspiration?: string;
  theme: Pick<StoreTheme, "colors" | "font" | "buttonStyle" | "cardStyle">;
}[] = [
  {
    id: "classic",
    label: "Clásico",
    desc: "Versátil",
    icon: "store",
    category: "classic",
    standard: true,
    theme: {
      colors: { primary: "#2563EB", accent: "#f59e0b", surface: "#ffffff" },
      font: "inter",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "fashion",
    label: "Moda",
    desc: "Indumentaria",
    icon: "shirt",
    category: "fashion",
    standard: true,
    theme: {
      // Minimalista monocromo, estética editorial.
      colors: { primary: "#1f2937", accent: "#b08968", surface: "#faf9f7" },
      font: "montserrat",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
  {
    id: "fashion-athletic",
    label: "Atleta Editorial",
    desc: "Ropa premium · lifestyle",
    icon: "medal",
    category: "fashion",
    inspiration: "https://www.cutsclothing.com",
    theme: {
      colors: { primary: "#292524", accent: "#a8917a", surface: "#fafaf9" },
      font: "inter",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
  {
    id: "fashion-streetwear",
    label: "Streetwear",
    desc: "Urbano · comunidad",
    icon: "flame",
    category: "fashion",
    inspiration: "https://paw3r.com",
    theme: {
      // Crema + negro bold, magenta como acento estrella (estilo paw3r).
      colors: { primary: "#141414", accent: "#ec1c8e", surface: "#f6f1ea" },
      font: "montserrat",
      buttonStyle: "square",
      cardStyle: "soft",
    },
  },
  {
    id: "accessories",
    label: "Accesorios",
    desc: "Joyería · premium",
    icon: "gem",
    category: "accessories",
    standard: true,
    theme: {
      // Elegante, dorado, serif sofisticado.
      colors: { primary: "#3f3328", accent: "#c9a227", surface: "#fbf7ef" },
      font: "lora",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "beauty",
    label: "Belleza",
    desc: "Salud y belleza",
    icon: "sparkles",
    category: "beauty",
    standard: true,
    theme: {
      // Suave, pastel, cuidado y bienestar.
      colors: { primary: "#c2649a", accent: "#7fb6a1", surface: "#fdf6f8" },
      font: "poppins",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "beauty-minimal",
    label: "Belleza Minimal",
    desc: "Suave · premium · aire",
    icon: "flower",
    category: "beauty",
    inspiration: "https://www.glossier.com",
    theme: {
      // Neutro y suave, rosado tenue, mucho aire (estilo Glossier).
      colors: { primary: "#a8657a", accent: "#e7b6ae", surface: "#fcf8f6" },
      font: "poppins",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "tech",
    label: "Tecnología",
    desc: "Electrónica",
    icon: "cpu",
    category: "tech",
    standard: true,
    theme: {
      // Moderno, alto contraste, líneas marcadas.
      colors: { primary: "#1e40af", accent: "#06b6d4", surface: "#f8fafc" },
      font: "montserrat",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
  {
    id: "tech-discover",
    label: "Descubre",
    desc: "Estilo app · moderno",
    icon: "smartphone",
    category: "tech",
    theme: {
      // App-like: fondo claro, verde vibrante, tarjetas muy redondeadas.
      colors: { primary: "#22c55e", accent: "#16a34a", surface: "#f7f8fa" },
      font: "poppins",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "sports",
    label: "Deportes",
    desc: "Energético",
    icon: "dumbbell",
    category: "sports",
    standard: true,
    theme: {
      // Vibrante y dinámico, naranja + negro atlético.
      colors: { primary: "#ea580c", accent: "#0f172a", surface: "#ffffff" },
      font: "montserrat",
      buttonStyle: "rounded",
      cardStyle: "bordered",
    },
  },
  {
    id: "sports-drops",
    label: "Drops",
    desc: "Coleccionables · hype",
    icon: "zap",
    category: "sports",
    inspiration: "https://www.repzarg.com",
    theme: {
      // Oscuro premium, acento neón, estética de drops/coleccionista.
      colors: { primary: "#101014", accent: "#a3e635", surface: "#0a0a0c" },
      font: "montserrat",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
];

/**
 * Build the block map + order for a layout, overlaying any saved customization
 * over the registry defaults. Layouts without a registry get empty maps.
 */
export function seedBlocks(
  layout: LayoutId,
  saved?: { blocks?: Record<string, Partial<ThemeBlock>>; blockOrder?: string[] },
): { blocks: Record<string, ThemeBlock>; blockOrder: string[] } {
  const defs = LAYOUT_BLOCKS[layout];
  if (!defs) return { blocks: {}, blockOrder: [] };

  const savedBlocks = saved?.blocks ?? {};
  const blocks: Record<string, ThemeBlock> = {};
  for (const d of defs) {
    const sv = savedBlocks[d.id] ?? {};
    blocks[d.id] = {
      enabled: typeof sv.enabled === "boolean" ? sv.enabled : true,
      title: typeof sv.title === "string" ? sv.title : "",
      subtitle: typeof sv.subtitle === "string" ? sv.subtitle : "",
    };
  }

  const reorderable = defs.filter((d) => d.reorderable).map((d) => d.id);
  const savedOrder = Array.isArray(saved?.blockOrder)
    ? saved!.blockOrder!.filter((id) => reorderable.includes(id))
    : [];
  const blockOrder = [
    ...savedOrder,
    ...reorderable.filter((id) => !savedOrder.includes(id)),
  ];

  return { blocks, blockOrder };
}

/** Resolved block (registry default merged with saved override). */
export function getBlock(
  theme: StoreTheme,
  id: string,
): { enabled: boolean; title: string; subtitle: string } {
  const def = (LAYOUT_BLOCKS[theme.layout] ?? []).find((d) => d.id === id);
  const b = theme.blocks[id];
  return {
    enabled: b?.enabled ?? true,
    title: (b?.title && b.title.trim()) || def?.defaultTitle || "",
    subtitle: (b?.subtitle && b.subtitle.trim()) || def?.defaultSubtitle || "",
  };
}

/** Merge a store's saved customization over defaults into a full theme. */
export function resolveTheme(
  store: Pick<Store, "primary_color" | "customization">,
): StoreTheme {
  const c = (store.customization ?? {}) as Partial<StoreTheme>;
  const basePrimary = store.primary_color || DEFAULT_THEME.colors.primary;
  const layout =
    c.layout && LAYOUT_IDS.includes(c.layout) ? c.layout : DEFAULT_THEME.layout;
  const seeded = seedBlocks(layout, {
    blocks: c.blocks as Record<string, Partial<ThemeBlock>> | undefined,
    blockOrder: c.blockOrder,
  });
  return {
    preset: c.preset ?? DEFAULT_THEME.preset,
    layout,
    colors: {
      primary: c.colors?.primary ?? basePrimary,
      accent: c.colors?.accent ?? DEFAULT_THEME.colors.accent,
      surface: c.colors?.surface ?? DEFAULT_THEME.colors.surface,
    },
    font: c.font ?? DEFAULT_THEME.font,
    buttonStyle: c.buttonStyle ?? DEFAULT_THEME.buttonStyle,
    cardStyle: c.cardStyle ?? DEFAULT_THEME.cardStyle,
    announcement: {
      enabled: c.announcement?.enabled ?? DEFAULT_THEME.announcement.enabled,
      text: c.announcement?.text ?? DEFAULT_THEME.announcement.text,
    },
    hero: {
      headline: c.hero?.headline ?? DEFAULT_THEME.hero.headline,
      subtext: c.hero?.subtext ?? DEFAULT_THEME.hero.subtext,
      ctaText: c.hero?.ctaText ?? DEFAULT_THEME.hero.ctaText,
    },
    about: {
      title: c.about?.title ?? DEFAULT_THEME.about.title,
      text: c.about?.text ?? DEFAULT_THEME.about.text,
    },
    sections:
      Array.isArray(c.sections) && c.sections.length
        ? c.sections.filter((s): s is SectionId =>
            ["featured", "catalog", "about"].includes(s),
          )
        : DEFAULT_THEME.sections,
    blocks: seeded.blocks,
    blockOrder: seeded.blockOrder,
    media: {
      heroSlides: cleanStrArray(c.media?.heroSlides),
      gallery: cleanStrArray(c.media?.gallery),
      pressLogos: cleanStrArray(c.media?.pressLogos),
    },
    testimonials: Array.isArray(c.testimonials)
      ? c.testimonials
          .filter(
            (t): t is Testimonial =>
              !!t && typeof t.quote === "string" && typeof t.author === "string",
          )
          .slice(0, 12)
      : [],
    locations: Array.isArray(c.locations)
      ? c.locations
          .filter(
            (l): l is Location =>
              !!l && typeof l.name === "string" && typeof l.address === "string",
          )
          .slice(0, 20)
      : [],
    heroVideoUrl: typeof c.heroVideoUrl === "string" ? c.heroVideoUrl : "",
  };
}

function cleanStrArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 12)
    : [];
}

/** CSS custom properties to apply on the storefront root for a theme. */
export function themeStyle(theme: StoreTheme): CSSProperties {
  const fontVar =
    THEME_FONTS.find((f) => f.id === theme.font)?.cssVar ?? "var(--font-inter)";
  const style: Record<string, string> = {
    "--font-store": fontVar,
    "--radius": theme.buttonStyle === "square" ? "0.25rem" : "0.9rem",
    fontFamily: `${fontVar}, system-ui, sans-serif`,
  };
  const primary = hexToHslTriplet(theme.colors.primary);
  const accent = hexToHslTriplet(theme.colors.accent);
  const surface = hexToHslTriplet(theme.colors.surface);
  if (primary) {
    style["--primary"] = primary;
    style["--ring"] = primary;
  }
  if (accent) style["--brand-accent"] = accent;
  if (surface) style["--background"] = surface;

  // When the surface is dark, switch the whole chrome (cards, text, borders,
  // header/footer) to a coherent dark token set so nothing renders dark-on-dark.
  if (isDarkColor(theme.colors.surface)) {
    Object.assign(style, {
      "--foreground": "0 0% 98%",
      "--card": "0 0% 9%",
      "--card-foreground": "0 0% 98%",
      "--popover": "0 0% 9%",
      "--popover-foreground": "0 0% 98%",
      "--muted": "0 0% 15%",
      "--muted-foreground": "0 0% 64%",
      "--secondary": "0 0% 15%",
      "--secondary-foreground": "0 0% 98%",
      "--accent": "0 0% 18%",
      "--accent-foreground": "0 0% 98%",
      "--border": "0 0% 20%",
      "--input": "0 0% 20%",
    });
  }
  return style as CSSProperties;
}
