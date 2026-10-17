import type { CSSProperties } from "react";
import { z } from "zod";

import {
  HERO_STYLES,
  SECTION_DEFS,
  newSection,
  newSectionId,
  normalizeSection,
  sectionSchema,
} from "@/lib/design/sections";
import type {
  AboutStyle,
  AnySection,
  DesignTokens,
  HeadingFont,
  HeroStyle,
  LookId,
  Section,
  SectionSettingsMap,
  SectionType,
  StoreDesign,
} from "@/lib/design/types";
import { isPro, type PlanFields } from "@/lib/plans";
import {
  DEFAULT_THEME,
  LAYOUT_IDS,
  THEME_FONTS,
  THEME_PRESETS,
  getBlock,
  isFreeLayout,
  resolveTheme,
  seedBlocks,
  standardLayoutFor,
  themeStyle,
  type StoreTheme,
} from "@/lib/theme";
import type { Json, Store } from "@/types/database";

/**
 * Armar, convertir, validar y aplicar el plan a un diseño v2.
 *
 * Todo lo de acá es puro (sin base de datos ni servidor): lo usan la tienda, el
 * editor y la IA por igual.
 */

export const HEADING_FONTS: { id: HeadingFont; label: string; cssVar?: string }[] = [
  { id: "auto", label: "La del estilo" },
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)" },
  { id: "poppins", label: "Poppins", cssVar: "var(--font-poppins)" },
  { id: "montserrat", label: "Montserrat", cssVar: "var(--font-montserrat)" },
  { id: "lora", label: "Lora (serif)", cssVar: "var(--font-lora)" },
  { id: "playfair", label: "Playfair (serif elegante)", cssVar: "var(--font-playfair)" },
  { id: "space", label: "Space Grotesk (moderna)", cssVar: "var(--font-space)" },
  { id: "bebas", label: "Bebas (condensada)", cssVar: "var(--font-bebas)" },
];

// ─── Plan ──────────────────────────────────────────────────────────────────

const PRO_HERO_STYLES = new Set(HERO_STYLES.filter((s) => s.pro).map((s) => s.value));
const PRO_ABOUT_STYLES = new Set<AboutStyle>(["banda", "archivo", "dividido"]);

/** ¿Esta sección, tal como está configurada, necesita Pro? */
export function sectionNeedsPro(section: AnySection): boolean {
  if (SECTION_DEFS[section.type].pro) return true;
  if (section.type === "hero") return PRO_HERO_STYLES.has(section.settings.style);
  if (section.type === "about") return PRO_ABOUT_STYLES.has(section.settings.style);
  return false;
}

/** Lo que del diseño solo se puede usar con Pro, para avisarlo antes de publicar. */
export function proFeaturesUsed(design: StoreDesign): string[] {
  const used: string[] = [];
  if (!isFreeLayout(design.tokens.look)) {
    const label = THEME_PRESETS.find((p) => p.id === design.tokens.look)?.label;
    used.push(`el estilo ${label ?? design.tokens.look}`);
  }
  for (const s of design.home) {
    if (!s.hidden && sectionNeedsPro(s)) used.push(SECTION_DEFS[s.type].label.toLowerCase());
  }
  return Array.from(new Set(used));
}

/**
 * El diseño tal como lo ve el público según el plan. Igual que con las
 * plantillas: si el Pro venció no se borra nada, solo deja de mostrarse. El
 * estilo baja al estándar de su categoría, las portadas y fondos Pro vuelven al
 * del estilo y las secciones Pro se esconden. Al renovar, vuelve todo.
 */
export function applyPlan(design: StoreDesign, pro: boolean): StoreDesign {
  if (pro) return design;
  return {
    ...design,
    tokens: { ...design.tokens, look: standardLayoutFor(design.tokens.look) },
    home: design.home.map((s) => {
      if (SECTION_DEFS[s.type].pro) return { ...s, hidden: true };
      if (s.type === "hero" && PRO_HERO_STYLES.has(s.settings.style)) {
        return { ...s, settings: { ...s.settings, style: "auto" as HeroStyle } };
      }
      if (s.type === "about" && PRO_ABOUT_STYLES.has(s.settings.style)) {
        return { ...s, settings: { ...s.settings, style: "auto" as AboutStyle } };
      }
      return s;
    }) as AnySection[],
  };
}

// ─── Estilo (CSS) ──────────────────────────────────────────────────────────

/** Variables CSS de la tienda para un diseño v2. */
export function designStyle(design: StoreDesign): CSSProperties {
  const t = design.tokens;
  const style = themeStyle({
    font: t.font,
    buttonStyle: t.buttonStyle,
    layout: t.look,
    colors: t.colors,
  }) as Record<string, string>;
  const heading = HEADING_FONTS.find((f) => f.id === t.headingFont)?.cssVar;
  if (heading) style["--font-heading"] = heading;
  return style as CSSProperties;
}

// ─── Conversión desde el diseño viejo ──────────────────────────────────────

function sec<T extends SectionType>(
  type: T,
  id: string,
  settings: Partial<SectionSettingsMap[T]>,
  hidden = false,
): Section<T> {
  const base = newSection(type, id);
  return {
    ...base,
    hidden: hidden || undefined,
    settings: { ...base.settings, ...settings },
  };
}

/**
 * Traduce el diseño de siempre (plantilla + `customization`) a secciones, de
 * forma que la tienda se vea igual que antes. También sirve para armar una
 * plantilla desde cero: se le pasa el tema por defecto de ese estilo.
 *
 * Los ids de las secciones salen de los bloques viejos, así que convertir dos
 * veces el mismo diseño da el mismo resultado.
 */
export function legacyToDesign(theme: StoreTheme): StoreDesign {
  const look = theme.layout;
  const b = (id: string) => getBlock(theme, id);
  const off = (id: string) => !b(id).enabled;
  const about = theme.about;

  const hero = sec("hero", "portada", {
    headline: theme.hero.headline,
    subtext: theme.hero.subtext,
    ctaText: theme.hero.ctaText,
    images: theme.media.heroSlides,
    videoUrl: theme.heroVideoUrl,
    countdown: look === "sports-drops" ? b("countdown").enabled : true,
    // Las portadas de Descubre y Belleza no llevaban el nombre arriba.
    showStoreName: look !== "tech-discover" && look !== "beauty",
  });

  // Cada plantilla con secciones configurables: mapa de bloque viejo → sección.
  const blocks: Record<string, () => AnySection> = {};
  let home: AnySection[];

  switch (look) {
    case "classic": {
      const featured = sec("products", "featured", { title: "Destacados" });
      const aboutSec = sec("about", "about", { title: about.title, text: about.text });
      const order = theme.sections;
      const rest: AnySection[] = order.map((id) =>
        id === "featured" ? featured : id === "about" ? aboutSec : sec("catalog", "catalog", {}),
      );
      if (!rest.some((s) => s.type === "catalog")) rest.push(sec("catalog", "catalog", {}));
      if (!order.includes("featured")) rest.push({ ...featured, hidden: true });
      if (!order.includes("about")) rest.push({ ...aboutSec, hidden: true });
      home = [hero, sec("benefits", "benefits", {}), ...rest];
      break;
    }
    case "fashion":
      home = [
        hero,
        sec("catalog", "catalog", {}),
        sec("gallery", "lookbook", { title: "Lookbook", style: "mosaico", useProductPhotos: true }),
        sec("about", "about", { title: about.title, text: about.text }),
      ];
      break;
    case "accessories":
    case "tech":
      home = [
        hero,
        sec("catalog", "catalog", {}),
        sec("about", "about", { title: about.title, text: about.text }),
      ];
      break;
    case "beauty":
      home = [
        hero,
        sec("products", "rutinas", {
          title: "Rutinas y kits",
          subtitle: "Arma tu rutina con nuestros favoritos.",
          limit: 6,
        }),
        sec("catalog", "catalog", {}),
        sec("about", "about", { title: about.title, text: about.text }),
      ];
      break;
    case "sports":
      home = [
        hero,
        sec("categories", "categorias", { title: "", style: "carrusel" }),
        sec("catalog", "catalog", {}),
        sec("about", "about", { title: about.title, text: about.text }),
      ];
      break;
    case "fashion-athletic":
      blocks["lo-nuevo"] = () => sec("products", "lo-nuevo", { title: b("lo-nuevo").title }, off("lo-nuevo"));
      blocks.catalog = () => sec("catalog", "catalog", { title: b("catalog").title });
      blocks.lifestyle = () =>
        sec("gallery", "lifestyle", { title: b("lifestyle").title, images: theme.media.gallery }, off("lifestyle"));
      blocks.prensa = () =>
        sec("logos", "prensa", { title: b("prensa").title, images: theme.media.pressLogos }, off("prensa"));
      blocks.about = () => sec("about", "about", { title: b("about").title, text: about.text }, off("about"));
      home = [hero];
      break;
    case "fashion-streetwear":
      blocks["lo-nuevo"] = () =>
        sec("products", "lo-nuevo", { title: b("lo-nuevo").title, subtitle: b("lo-nuevo").subtitle }, off("lo-nuevo"));
      blocks.colecciones = () => sec("collections", "colecciones", {}, off("colecciones"));
      blocks.galeria = () =>
        sec("gallery", "galeria", { title: b("galeria").title, images: theme.media.gallery, useProductPhotos: false }, off("galeria"));
      blocks.catalog = () => sec("catalog", "catalog", { title: b("catalog").title });
      blocks.testimonios = () =>
        sec("testimonials", "testimonios", { title: b("testimonios").title, items: theme.testimonials }, off("testimonios"));
      blocks.locales = () =>
        sec(
          "locations",
          "locales",
          { title: b("locales").title, subtitle: b("locales").subtitle, items: theme.locations },
          off("locales"),
        );
      blocks.marca = () =>
        sec("about", "marca", { title: b("marca").title, eyebrow: b("marca").subtitle, text: about.text }, off("marca"));
      home = [hero];
      break;
    case "beauty-minimal":
      blocks.categorias = () => sec("categories", "categorias", { title: b("categorias").title }, off("categorias"));
      blocks["shop-all"] = () =>
        sec(
          "products",
          "shop-all",
          { title: b("shop-all").title, subtitle: b("shop-all").subtitle, layout: "grilla", limit: 12 },
          off("shop-all"),
        );
      blocks["get-the-look"] = () =>
        sec(
          "products",
          "get-the-look",
          { title: b("get-the-look").title, subtitle: b("get-the-look").subtitle, source: "combos", layout: "grilla", limit: 4 },
          off("get-the-look"),
        );
      blocks.catalog = () => sec("catalog", "catalog", { title: b("catalog").title });
      blocks.testimonios = () =>
        sec("testimonials", "testimonios", { title: b("testimonios").title, items: theme.testimonials }, off("testimonios"));
      blocks.historia = () =>
        sec(
          "about",
          "historia",
          { title: b("historia").title, text: about.text, image: theme.media.gallery[0] ?? "" },
          off("historia"),
        );
      home = [hero];
      break;
    case "tech-discover":
      // En Descubre la portada es un bloque más: se puede mover y apagar.
      blocks.promo = () => ({ ...hero, hidden: off("promo") || undefined });
      blocks.categorias = () => sec("categories", "categorias", { title: b("categorias").title }, off("categorias"));
      blocks.destacados = () =>
        sec(
          "products",
          "destacados",
          { title: b("destacados").title, layout: "grilla", limit: 4, viewAll: true },
          off("destacados"),
        );
      blocks.catalog = () => sec("catalog", "catalog", { title: b("catalog").title });
      blocks.about = () => sec("about", "about", { title: b("about").title, text: about.text }, off("about"));
      home = [];
      break;
    case "sports-drops":
      blocks.ligas = () => sec("categories", "ligas", { title: "" }, off("ligas"));
      blocks.recien = () =>
        sec("products", "recien", { title: b("recien").title, source: "recientes", limit: 8 }, off("recien"));
      blocks["mas-vendidos"] = () =>
        sec("products", "mas-vendidos", { title: b("mas-vendidos").title, accent: true }, off("mas-vendidos"));
      blocks.colecciones = () => sec("collections", "colecciones", {}, off("colecciones"));
      blocks.catalog = () => sec("catalog", "catalog", { title: b("catalog").title });
      blocks.archivo = () =>
        sec(
          "about",
          "archivo",
          { eyebrow: b("archivo").title, title: about.title, text: about.text },
          off("archivo"),
        );
      home = [hero];
      break;
  }

  if (Object.keys(blocks).length) {
    for (const id of theme.blockOrder) {
      const make = blocks[id];
      if (make) home.push(make());
    }
  }

  const preset = THEME_PRESETS.find((p) => p.id === look)?.theme;
  return {
    v: 1,
    tokens: {
      look,
      colors: theme.colors,
      font: theme.font,
      headingFont: "auto",
      buttonStyle: theme.buttonStyle ?? preset?.buttonStyle ?? "rounded",
      cardStyle: theme.cardStyle ?? preset?.cardStyle ?? "soft",
    },
    header: {
      announcement: { ...theme.announcement, style: "auto" },
    },
    home,
  };
}

/** El tema por defecto de un estilo: lo que se ve al elegir esa plantilla de cero. */
function defaultThemeFor(look: LookId): StoreTheme {
  const preset = THEME_PRESETS.find((p) => p.id === look)!.theme;
  return {
    ...DEFAULT_THEME,
    ...preset,
    preset: look,
    layout: look,
    sections: ["featured", "catalog", "about"],
    ...seedBlocks(look),
  };
}

/** Una plantilla lista para usar: estilo, colores y secciones de ese estilo. */
export function templateDesign(look: LookId): StoreDesign {
  return legacyToDesign(defaultThemeFor(look));
}

/**
 * Cambia el estilo de un diseño sin perder lo que el comerciante escribió: se
 * quedan sus secciones y textos, cambian el look, la fuente y los colores.
 */
export function switchLook(design: StoreDesign, look: LookId): StoreDesign {
  const preset = THEME_PRESETS.find((p) => p.id === look)!.theme;
  return {
    ...design,
    tokens: {
      ...design.tokens,
      look,
      colors: preset.colors,
      font: preset.font,
      buttonStyle: preset.buttonStyle,
      cardStyle: preset.cardStyle,
      headingFont: "auto",
    },
  };
}

// ─── Leer y validar ────────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Lee un diseño guardado (JSON de la base) completando lo que falte. null si
 * no hay diseño o no se puede leer: quien llama cae al diseño viejo.
 */
export function parseDesign(raw: Json | null | undefined): StoreDesign | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  const t = (r.tokens ?? {}) as Partial<DesignTokens>;
  const look = LAYOUT_IDS.includes(t.look as LookId) ? (t.look as LookId) : "classic";
  const preset = THEME_PRESETS.find((p) => p.id === look)!.theme;
  const color = (v: unknown, fallback: string) =>
    typeof v === "string" && HEX.test(v) ? v : fallback;
  const home = (Array.isArray(r.home) ? r.home : [])
    .map(normalizeSection)
    .filter((s): s is AnySection => s !== null);
  // Siempre hay un catálogo: es la única sección que no se puede quitar.
  if (!home.some((s) => s.type === "catalog")) home.push(newSection("catalog", "catalog") as AnySection);
  const ann = ((r.header as Record<string, unknown> | undefined)?.announcement ?? {}) as Record<string, unknown>;

  return {
    v: 1,
    tokens: {
      look,
      colors: {
        primary: color(t.colors?.primary, preset.colors.primary),
        accent: color(t.colors?.accent, preset.colors.accent),
        surface: color(t.colors?.surface, preset.colors.surface),
      },
      font: THEME_FONTS.some((f) => f.id === t.font) ? t.font! : preset.font,
      headingFont: HEADING_FONTS.some((f) => f.id === t.headingFont) ? t.headingFont! : "auto",
      buttonStyle: t.buttonStyle === "square" ? "square" : t.buttonStyle === "rounded" ? "rounded" : preset.buttonStyle,
      cardStyle: t.cardStyle === "bordered" ? "bordered" : t.cardStyle === "soft" ? "soft" : preset.cardStyle,
    },
    header: {
      announcement: {
        enabled: ann.enabled === true,
        text: typeof ann.text === "string" ? ann.text.slice(0, 140) : "",
        style: ann.style === "fija" || ann.style === "movimiento" ? ann.style : "auto",
      },
    },
    home,
  };
}

const hex = z.string().regex(HEX, "Color inválido");

/** Validación completa para guardar (borrador o publicado). */
export const designSchema = z.object({
  v: z.literal(1),
  tokens: z.object({
    look: z.enum(LAYOUT_IDS as [LookId, ...LookId[]]),
    colors: z.object({ primary: hex, accent: hex, surface: hex }),
    font: z.enum(THEME_FONTS.map((f) => f.id) as [string, ...string[]]),
    headingFont: z.enum(HEADING_FONTS.map((f) => f.id) as [string, ...string[]]),
    buttonStyle: z.enum(["rounded", "square"]),
    cardStyle: z.enum(["soft", "bordered"]),
  }),
  header: z.object({
    announcement: z.object({
      enabled: z.boolean(),
      text: z.string().max(140),
      style: z.enum(["auto", "fija", "movimiento"]),
    }),
  }),
  home: z
    .array(sectionSchema)
    .min(1)
    .max(30)
    .refine((home) => home.filter((s) => s.type === "catalog").length === 1, {
      message: "El catálogo tiene que estar una vez",
    })
    .refine((home) => new Set(home.map((s) => s.id)).size === home.length, {
      message: "Hay secciones repetidas",
    }),
});

// ─── El diseño de una tienda ───────────────────────────────────────────────

export type DesignStore = Pick<Store, "primary_color" | "customization"> &
  Partial<PlanFields> & { design?: Json | null };

/**
 * El diseño guardado de la tienda, sin aplicar el plan: el publicado, o si
 * nunca publicó con el editor nuevo, el de siempre traducido a secciones.
 */
export function savedDesign(store: DesignStore): StoreDesign {
  // resolveTheme baja la plantilla si el Pro venció; acá se convierte con la
  // plantilla que eligió, y el plan se aplica aparte, una sola vez.
  return (
    parseDesign(store.design) ??
    legacyToDesign(resolveTheme({ ...store, plan: "pro", plan_expires_at: null }))
  );
}

/** El diseño que ve el público, con el plan ya aplicado. */
export function publishedDesign(store: DesignStore): StoreDesign {
  return applyPlan(savedDesign(store), isPro(store));
}

/**
 * Lleva una propuesta de la IA (que todavía habla el idioma de las plantillas)
 * a un diseño v2 que ya existe: toma su estilo, colores, fuentes, anuncio y
 * textos, y deja las secciones del comerciante donde estaban. Si no tenía
 * portada o "Sobre nosotros", se agregan.
 */
export function mergeAiProposal(draft: StoreDesign, theme: StoreTheme): StoreDesign {
  const converted = legacyToDesign(theme);
  const home = draft.home.map((s) => {
    if (s.type === "hero") {
      return {
        ...s,
        settings: {
          ...s.settings,
          headline: theme.hero.headline,
          subtext: theme.hero.subtext,
          ctaText: theme.hero.ctaText,
        },
      };
    }
    if (s.type === "about" && theme.about.text) {
      return {
        ...s,
        settings: { ...s.settings, title: theme.about.title || s.settings.title, text: theme.about.text },
      };
    }
    return s;
  }) as AnySection[];

  const hero = converted.home.find((s) => s.type === "hero");
  if (hero && !home.some((s) => s.type === "hero")) home.unshift({ ...hero, id: newSectionId() });
  const about = converted.home.find((s) => s.type === "about");
  if (about && theme.about.text && !home.some((s) => s.type === "about")) {
    home.push({ ...about, id: newSectionId(), hidden: undefined });
  }
  return { ...draft, tokens: converted.tokens, header: converted.header, home };
}
