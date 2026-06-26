import type { CSSProperties } from "react";

import { hexToHslTriplet } from "@/lib/color";
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
  | "accessories"
  | "beauty"
  | "tech"
  | "sports";

export const LAYOUT_IDS: LayoutId[] = [
  "classic",
  "fashion",
  "fashion-athletic",
  "accessories",
  "beauty",
  "tech",
  "sports",
];

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
}

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
};

export const THEME_PRESETS: {
  id: string;
  label: string;
  desc: string;
  icon: string;
  theme: Pick<StoreTheme, "colors" | "font" | "buttonStyle" | "cardStyle">;
}[] = [
  {
    id: "classic",
    label: "Clásico",
    desc: "Versátil",
    icon: "store",
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
    theme: {
      colors: { primary: "#292524", accent: "#a8917a", surface: "#fafaf9" },
      font: "inter",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
  {
    id: "accessories",
    label: "Accesorios",
    desc: "Joyería · premium",
    icon: "gem",
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
    theme: {
      // Suave, pastel, cuidado y bienestar.
      colors: { primary: "#c2649a", accent: "#7fb6a1", surface: "#fdf6f8" },
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
    theme: {
      // Moderno, alto contraste, líneas marcadas.
      colors: { primary: "#1e40af", accent: "#06b6d4", surface: "#f8fafc" },
      font: "montserrat",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
  {
    id: "sports",
    label: "Deportes",
    desc: "Energético",
    icon: "dumbbell",
    theme: {
      // Vibrante y dinámico, naranja + negro atlético.
      colors: { primary: "#ea580c", accent: "#0f172a", surface: "#ffffff" },
      font: "montserrat",
      buttonStyle: "rounded",
      cardStyle: "bordered",
    },
  },
];

/** Merge a store's saved customization over defaults into a full theme. */
export function resolveTheme(
  store: Pick<Store, "primary_color" | "customization">,
): StoreTheme {
  const c = (store.customization ?? {}) as Partial<StoreTheme>;
  const basePrimary = store.primary_color || DEFAULT_THEME.colors.primary;
  return {
    preset: c.preset ?? DEFAULT_THEME.preset,
    layout:
      c.layout && LAYOUT_IDS.includes(c.layout) ? c.layout : DEFAULT_THEME.layout,
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
  };
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
  return style as CSSProperties;
}
