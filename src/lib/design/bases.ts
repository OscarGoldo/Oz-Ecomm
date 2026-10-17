import { z } from "zod";

import { proFeaturesUsed } from "@/lib/design/design";
import { newSection, newSectionId } from "@/lib/design/sections";
import type {
  AnySection,
  DesignTokens,
  HeroStyle,
  LookId,
  SectionSettingsMap,
  SectionType,
  StoreDesign,
} from "@/lib/design/types";
import { THEME_FONTS, type ThemeFont } from "@/lib/theme";

/**
 * Los diseños base: personalidades completas armadas combinando piezas
 * (tarjeta, títulos, encabezado, pie, aire, fuentes) y una receta de
 * secciones. Sirven para cualquier rubro; el rubro solo cambia la paleta.
 *
 * Es la idea de Tiendanube (pocos diseños base, muchas versiones por rubro)
 * con una diferencia: acá se prueban con los productos de la propia tienda.
 *
 * Agregar un diseño base es agregar un objeto a BASES. No hay componentes
 * nuevos que escribir.
 */

export type RubroId = "general" | "moda" | "tecnologia" | "belleza" | "hogar" | "comida";

export const RUBROS: { id: RubroId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "moda", label: "Moda" },
  { id: "tecnologia", label: "Tecnología" },
  { id: "belleza", label: "Belleza" },
  { id: "hogar", label: "Hogar" },
  { id: "comida", label: "Comida" },
];

type Palette = DesignTokens["colors"];

export interface DesignBase {
  id: string;
  name: string;
  /** Dos o tres palabras: lo que se lee en la tarjeta de la vitrina. */
  tagline: string;
  description: string;
  tokens: Omit<DesignTokens, "colors" | "base">;
  /** La portada de este diseño, aunque el estilo de la tienda traiga otra. */
  hero: Exclude<HeroStyle, "auto">;
  palettes: Record<RubroId, Palette>;
  home: () => AnySection[];
}

function s<T extends SectionType>(type: T, settings: Partial<SectionSettingsMap[T]> = {}): AnySection {
  const base = newSection(type);
  return { ...base, settings: { ...base.settings, ...settings } } as AnySection;
}

const p = (primary: string, accent: string, surface: string): Palette => ({ primary, accent, surface });

export const BASES: DesignBase[] = [
  {
    id: "caracas",
    name: "Caracas",
    tagline: "Minimalista",
    description: "Mucho blanco, letras finas y fotos que respiran. Para marcas que quieren verse premium sin decir de más.",
    tokens: {
      look: "accessories",
      card: "accessories",
      heading: "accessories",
      header: "accessories",
      footer: "accessories",
      density: "amplia",
      font: "dmsans",
      headingFont: "playfair",
      buttonStyle: "square",
      cardStyle: "soft",
    },
    hero: "minimal",
    palettes: {
      general: p("#1f1f1f", "#b8a07e", "#ffffff"),
      moda: p("#222222", "#c9a99a", "#fbf9f7"),
      tecnologia: p("#1c1f24", "#7a8a99", "#ffffff"),
      belleza: p("#3a2e2c", "#d8b4a6", "#fdf8f5"),
      hogar: p("#2f3a33", "#a9b8a0", "#fbfaf6"),
      comida: p("#2b2420", "#c08a5b", "#fffbf6"),
    },
    home: () => [
      s("hero", { style: "minimal" }),
      s("categories", { title: "Explora", style: "pastillas" }),
      s("products", { title: "Favoritos", layout: "grilla", limit: 8 }),
      s("catalog", { title: "Toda la colección" }),
      s("about", { style: "centrado" }),
      s("faq"),
    ],
  },
  {
    id: "merida",
    name: "Mérida",
    tagline: "Editorial",
    description: "Fotos grandes y titulares de revista. Ideal para moda, decoración o marcas con buenas fotos.",
    tokens: {
      look: "fashion",
      card: "fashion",
      heading: "fashion",
      header: "fashion",
      footer: "fashion",
      density: "normal",
      font: "inter",
      headingFont: "fraunces",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
    hero: "editorial",
    palettes: {
      general: p("#111111", "#c2a27c", "#f7f5f2"),
      moda: p("#1a1a1a", "#b08968", "#faf8f5"),
      tecnologia: p("#0f1115", "#8a9bb0", "#f5f6f8"),
      belleza: p("#2d2226", "#c79a9a", "#faf6f4"),
      hogar: p("#262a24", "#b59a74", "#f6f3ee"),
      comida: p("#231c17", "#d08c4f", "#faf6f0"),
    },
    home: () => [
      s("hero", { style: "editorial" }),
      s("products", { title: "Lo nuevo", source: "recientes", layout: "carrusel", limit: 10 }),
      s("catalog", { title: "La colección" }),
      s("gallery", { title: "Lookbook", style: "mosaico", useProductPhotos: true }),
      s("about", { style: "centrado" }),
      s("whatsapp"),
    ],
  },
  {
    id: "maracaibo",
    name: "Maracaibo",
    tagline: "Técnica",
    description: "Líneas marcadas, mayúsculas y un buscador grande. Para tecnología, repuestos, ferretería o catálogos con mucha referencia.",
    tokens: {
      look: "tech",
      card: "tech",
      heading: "tech",
      header: "tech",
      footer: "tech",
      density: "compacta",
      font: "inter",
      headingFont: "space",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
    hero: "buscador",
    palettes: {
      general: p("#1e40af", "#06b6d4", "#f8fafc"),
      moda: p("#18181b", "#e11d48", "#fafafa"),
      tecnologia: p("#0f3f7a", "#2bb5e8", "#f5f7fa"),
      belleza: p("#6d28d9", "#f472b6", "#faf7ff"),
      hogar: p("#166534", "#f59e0b", "#f8faf7"),
      comida: p("#b91c1c", "#f59e0b", "#fffaf5"),
    },
    home: () => [
      s("hero", { style: "buscador" }),
      s("benefits"),
      s("categories", { title: "Categorías", style: "pastillas" }),
      s("products", { title: "Lo más buscado", layout: "carrusel", viewAll: true }),
      s("catalog"),
      s("faq"),
      s("about", { style: "tarjeta" }),
    ],
  },
  {
    id: "barquisimeto",
    name: "Barquisimeto",
    tagline: "Catálogo grande",
    description: "Ordenada para tiendas con muchos productos: categorías a mano y lo destacado y lo nuevo arriba.",
    tokens: {
      look: "classic",
      card: "classic",
      heading: "classic",
      header: "classic",
      footer: "classic",
      density: "normal",
      font: "outfit",
      headingFont: "outfit",
      buttonStyle: "rounded",
      cardStyle: "bordered",
    },
    hero: "clasico",
    palettes: {
      general: p("#2563eb", "#f59e0b", "#ffffff"),
      moda: p("#be185d", "#f59e0b", "#ffffff"),
      tecnologia: p("#0f3f7a", "#22c55e", "#ffffff"),
      belleza: p("#db2777", "#14b8a6", "#fff7fb"),
      hogar: p("#15803d", "#ea580c", "#ffffff"),
      comida: p("#dc2626", "#facc15", "#fffdf7"),
    },
    home: () => [
      s("hero", { style: "clasico" }),
      s("benefits"),
      s("categories", { title: "Compra por categoría", style: "pastillas" }),
      s("products", { title: "Destacados", layout: "carrusel", viewAll: true }),
      s("products", { title: "Lo nuevo", source: "recientes", layout: "carrusel" }),
      s("catalog"),
      s("faq"),
      s("whatsapp"),
    ],
  },
  {
    id: "margarita",
    name: "Margarita",
    tagline: "Audaz",
    description: "Colores plenos, títulos gruesos y mucha energía. Para marcas jóvenes que quieren que las vean.",
    tokens: {
      look: "fashion-streetwear",
      card: "fashion-streetwear",
      heading: "fashion-streetwear",
      header: "sports",
      footer: "fashion-streetwear",
      density: "normal",
      font: "montserrat",
      headingFont: "bebas",
      buttonStyle: "square",
      cardStyle: "soft",
    },
    hero: "urbano",
    palettes: {
      general: p("#111111", "#ff3d7f", "#fff4ea"),
      moda: p("#141414", "#ec1c8e", "#f6f1ea"),
      tecnologia: p("#0b0b0f", "#00b8d9", "#f2f4f7"),
      belleza: p("#2b0a3d", "#ff5fa2", "#fff1f6"),
      hogar: p("#1d2b24", "#e09f00", "#f7f3e9"),
      comida: p("#1a0f0a", "#ff6b00", "#fff3e0"),
    },
    home: () => [
      s("hero", { style: "urbano" }),
      s("products", { title: "Lo más pedido", layout: "carrusel", accent: true }),
      s("collections"),
      s("catalog", { title: "Toda la tienda" }),
      s("testimonials"),
      s("about", { style: "banda" }),
      s("whatsapp"),
    ],
  },
  {
    id: "valencia",
    name: "Valencia",
    tagline: "Amigable",
    description: "Redondeada, cercana y con aire de app. Perfecta para comida, niños, mascotas o regalos.",
    tokens: {
      look: "tech-discover",
      card: "tech-discover",
      heading: "tech-discover",
      header: "tech-discover",
      footer: "tech-discover",
      density: "normal",
      font: "nunito",
      headingFont: "nunito",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
    hero: "promo",
    palettes: {
      general: p("#16a34a", "#f97316", "#f7f8fa"),
      moda: p("#e11d48", "#8b5cf6", "#fdf7f9"),
      tecnologia: p("#2563eb", "#22c55e", "#f5f7fb"),
      belleza: p("#db2777", "#fb923c", "#fff6f9"),
      hogar: p("#0d9488", "#f59e0b", "#f6faf9"),
      comida: p("#ea580c", "#16a34a", "#fffaf3"),
    },
    home: () => [
      s("hero", { style: "promo" }),
      s("categories", { title: "¿Qué buscas hoy?", style: "pastillas" }),
      s("products", { title: "Los favoritos", layout: "grilla", limit: 4, viewAll: true }),
      s("catalog"),
      s("faq"),
      s("whatsapp"),
      s("about", { style: "tarjeta" }),
    ],
  },
];

export function getBase(id: string | undefined): DesignBase | undefined {
  return BASES.find((b) => b.id === id);
}

/** El rubro que le toca a una tienda según su estilo, para abrir la vitrina en algo cercano. */
export function rubroForLook(look: LookId): RubroId {
  if (look.startsWith("fashion") || look === "accessories") return "moda";
  if (look.startsWith("beauty")) return "belleza";
  if (look.startsWith("tech")) return "tecnologia";
  return "general";
}

// ─── Aplicar un diseño base o un cambio puntual ────────────────────────────

/**
 * Un cambio que se puede previsualizar sin guardar (viaja en la URL de la
 * vista previa) y después aplicar al borrador. Lo usan la vitrina y la IA.
 */
export interface DesignPatch {
  base?: string;
  rubro?: RubroId;
  /** Mantener las secciones del comerciante en vez de las del diseño base. */
  keepSections?: boolean;
  tokens?: Partial<Pick<DesignTokens, "colors" | "font" | "headingFont" | "buttonStyle">>;
  texts?: {
    headline?: string;
    subtext?: string;
    ctaText?: string;
    aboutTitle?: string;
    aboutText?: string;
    announcement?: string;
  };
}

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const patchSchema = z.object({
  base: z.string().max(40).optional(),
  rubro: z.enum(RUBROS.map((r) => r.id) as [RubroId, ...RubroId[]]).optional(),
  keepSections: z.boolean().optional(),
  tokens: z
    .object({
      colors: z.object({ primary: hex, accent: hex, surface: hex }).optional(),
      font: z.enum(THEME_FONTS.map((f) => f.id) as [ThemeFont, ...ThemeFont[]]).optional(),
      headingFont: z
        .enum(["auto", "inter", "poppins", "montserrat", "lora", "playfair", "space", "bebas", "dmsans", "nunito", "outfit", "fraunces"])
        .optional(),
      buttonStyle: z.enum(["rounded", "square"]).optional(),
    })
    .optional(),
  texts: z
    .object({
      headline: z.string().max(140).optional(),
      subtext: z.string().max(240).optional(),
      ctaText: z.string().max(40).optional(),
      aboutTitle: z.string().max(80).optional(),
      aboutText: z.string().max(2000).optional(),
      announcement: z.string().max(140).optional(),
    })
    .optional(),
});

/**
 * Lo que el comerciante cargó en cada tipo de sección y no se puede perder al
 * cambiar de diseño: textos, fotos, testimonios, preguntas. El diseño base pone
 * la forma; esto pone el contenido.
 */
const CONTENT_KEYS: Partial<Record<SectionType, string[]>> = {
  hero: ["headline", "subtext", "ctaText", "ctaLink", "images", "videoUrl"],
  about: ["title", "eyebrow", "text", "image"],
  testimonials: ["title", "items"],
  locations: ["title", "subtitle", "items"],
  faq: ["title", "items"],
  gallery: ["title", "images"],
  logos: ["title", "images"],
  imageText: ["title", "text", "image", "ctaText", "ctaLink"],
  banner: ["title", "text", "ctaText", "ctaLink", "image"],
  whatsapp: ["title", "text", "ctaText"],
  catalog: ["title"],
};

function hasValue(v: unknown): boolean {
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

/** ¿La sección tiene contenido propio del comerciante que valga la pena conservar? */
function hasContent(sec: AnySection): boolean {
  const keys = CONTENT_KEYS[sec.type] ?? [];
  const settings = sec.settings as Record<string, unknown>;
  return keys.some((k) => k !== "title" && hasValue(settings[k]));
}

/**
 * Las secciones del diseño base, rellenas con el contenido que el comerciante
 * ya tenía. Lo que tenía y el diseño base no trae (sus testimonios, sus
 * preguntas) se agrega al final: cambiar de diseño nunca borra contenido.
 */
function carryContent(recipe: AnySection[], current: AnySection[]): AnySection[] {
  const used = new Set<string>();
  const home = recipe.map((sec) => {
    const keys = CONTENT_KEYS[sec.type];
    const from = current.find((c) => c.type === sec.type && !used.has(c.id));
    if (!keys || !from) return sec;
    used.add(from.id);
    const settings = { ...sec.settings } as Record<string, unknown>;
    const old = from.settings as Record<string, unknown>;
    for (const k of keys) if (hasValue(old[k])) settings[k] = old[k];
    return { ...sec, settings } as AnySection;
  });
  for (const c of current) {
    if (!used.has(c.id) && c.type !== "products" && hasContent(c)) {
      home.push({ ...c, id: newSectionId() });
    }
  }
  return home;
}

/** Aplica un diseño base y/o cambios puntuales a un diseño. No guarda nada. */
export function applyPatch(design: StoreDesign, patch: DesignPatch): StoreDesign {
  let next: StoreDesign = design;
  const base = getBase(patch.base);

  if (base) {
    const rubro = patch.rubro ?? "general";
    const hero = (sec: AnySection) =>
      sec.type === "hero" ? ({ ...sec, settings: { ...sec.settings, style: base.hero } } as AnySection) : sec;
    next = {
      ...design,
      tokens: { ...base.tokens, colors: base.palettes[rubro], base: base.id },
      home: patch.keepSections ? design.home.map(hero) : carryContent(base.home(), design.home),
    };
  }

  if (patch.tokens) next = { ...next, tokens: { ...next.tokens, ...patch.tokens } };

  const t = patch.texts;
  if (t) {
    let aboutDone = false;
    let home = next.home.map((sec) => {
      if (sec.type === "hero") {
        return {
          ...sec,
          settings: {
            ...sec.settings,
            ...(t.headline !== undefined && { headline: t.headline }),
            ...(t.subtext !== undefined && { subtext: t.subtext }),
            ...(t.ctaText !== undefined && { ctaText: t.ctaText }),
          },
        } as AnySection;
      }
      if (sec.type === "about" && !aboutDone && t.aboutText) {
        aboutDone = true;
        return {
          ...sec,
          hidden: undefined,
          settings: { ...sec.settings, title: t.aboutTitle || sec.settings.title, text: t.aboutText },
        } as AnySection;
      }
      return sec;
    });
    if (t.aboutText && !aboutDone) {
      home = [...home, s("about", { title: t.aboutTitle || "Sobre nosotros", text: t.aboutText })];
    }
    next = { ...next, home };
    if (t.announcement !== undefined) {
      next = {
        ...next,
        header: {
          announcement: {
            ...next.header.announcement,
            enabled: t.announcement.trim().length > 0,
            text: t.announcement,
          },
        },
      };
    }
  }
  return next;
}

/** El diseño base solo, para saber si es Pro y para mostrarlo en la IA. */
export function baseDesign(base: DesignBase, rubro: RubroId = "general"): StoreDesign {
  return {
    v: 1,
    tokens: { ...base.tokens, colors: base.palettes[rubro], base: base.id },
    header: { announcement: { enabled: false, text: "", style: "auto" } },
    home: base.home(),
  };
}

/** ¿Este diseño base necesita Pro? Sale de sus piezas y secciones, no de una lista aparte. */
export function baseNeedsPro(base: DesignBase): boolean {
  return proFeaturesUsed(baseDesign(base)).length > 0;
}

// ─── Viaje en la URL ───────────────────────────────────────────────────────

/** El cambio, comprimido para la URL de la vista previa (?p=…). */
export function encodePatch(patch: DesignPatch): string {
  const json = JSON.stringify(patch);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePatch(raw: string | undefined | null): DesignPatch | null {
  if (!raw || raw.length > 8000) return null;
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = patchSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
