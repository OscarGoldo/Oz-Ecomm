import type { CSSProperties } from "react";

import { hexToHslTriplet } from "@/lib/color";
import type { Store } from "@/types/database";

export type ThemeFont = "inter" | "poppins" | "montserrat" | "lora";
export type ButtonStyle = "rounded" | "square";
export type CardStyle = "soft" | "bordered";
export type SectionId = "featured" | "catalog" | "about";

export interface StoreTheme {
  preset: string;
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
  theme: Pick<StoreTheme, "colors" | "font" | "buttonStyle" | "cardStyle">;
}[] = [
  {
    id: "classic",
    label: "Clásico",
    theme: {
      colors: { primary: "#2563EB", accent: "#f59e0b", surface: "#ffffff" },
      font: "inter",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "modern",
    label: "Moderno",
    theme: {
      colors: { primary: "#111827", accent: "#10b981", surface: "#f9fafb" },
      font: "poppins",
      buttonStyle: "square",
      cardStyle: "bordered",
    },
  },
  {
    id: "elegant",
    label: "Elegante",
    theme: {
      colors: { primary: "#8b5e3c", accent: "#c79a3a", surface: "#faf7f2" },
      font: "lora",
      buttonStyle: "rounded",
      cardStyle: "soft",
    },
  },
  {
    id: "vibrant",
    label: "Vibrante",
    theme: {
      colors: { primary: "#db2777", accent: "#7c3aed", surface: "#fff7fb" },
      font: "montserrat",
      buttonStyle: "rounded",
      cardStyle: "soft",
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
