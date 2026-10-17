import type {
  ButtonStyle,
  CardStyle,
  LayoutId,
  ThemeFont,
} from "@/lib/theme";

/**
 * El diseño de una tienda, versión 2: una lista de secciones que el
 * comerciante arma, ordena y configura, encima de un "estilo" (look).
 *
 * El estilo es lo que antes era la plantilla: decide cómo se ven las tarjetas
 * de producto, los títulos, el encabezado y el pie. Las secciones son las
 * mismas para todos los estilos, así que cualquier sección va en cualquier
 * estilo (antes, los testimonios solo existían en Streetwear y Belleza Minimal).
 *
 * Se guarda tal cual como JSON en `stores.design` (publicado) y
 * `stores.design_draft` (borrador). Ver migración 0033.
 */

/** Los estilos son las plantillas de siempre: mismos ids, mismo look. */
export type LookId = LayoutId;

/** Fuente de los títulos. "auto" = la que trae el estilo. */
export type HeadingFont =
  | "auto"
  | "inter"
  | "poppins"
  | "montserrat"
  | "lora"
  | "playfair"
  | "space"
  | "bebas";

export interface DesignTokens {
  look: LookId;
  colors: { primary: string; accent: string; surface: string };
  font: ThemeFont;
  headingFont: HeadingFont;
  buttonStyle: ButtonStyle;
  cardStyle: CardStyle;
}

export type AnnouncementStyle = "auto" | "fija" | "movimiento";

export interface DesignHeader {
  announcement: { enabled: boolean; text: string; style: AnnouncementStyle };
}

export interface StoreDesign {
  v: 1;
  tokens: DesignTokens;
  header: DesignHeader;
  home: AnySection[];
}

/** Estilos de portada. Cada uno nació de una plantilla; ahora van en cualquiera. */
export type HeroStyle =
  | "auto"
  | "clasico"
  | "editorial"
  | "atleta"
  | "urbano"
  | "minimal"
  | "suave"
  | "dividido"
  | "buscador"
  | "promo"
  | "energetico"
  | "campana";

export type AboutStyle = "auto" | "tarjeta" | "centrado" | "banda" | "archivo" | "dividido";
export type CategoriesStyle = "auto" | "pastillas" | "circulos" | "carrusel";
export type GalleryStyle = "auto" | "grilla" | "mosaico";
export type ProductSource = "destacados" | "recientes" | "combos" | "categoria";
export type BannerTone = "marca" | "acento" | "oscuro";

export interface SectionSettingsMap {
  hero: {
    style: HeroStyle;
    headline: string;
    subtext: string;
    ctaText: string;
    /** "" = baja al catálogo. */
    ctaLink: string;
    /** Rutas de storage. Vacío = el banner de la tienda. */
    images: string[];
    videoUrl: string;
    showStoreName: boolean;
    countdown: boolean;
  };
  benefits: { title: string };
  products: {
    title: string;
    subtitle: string;
    source: ProductSource;
    category: string;
    layout: "carrusel" | "grilla";
    limit: number;
    viewAll: boolean;
    accent: boolean;
  };
  collections: { title: string };
  categories: { title: string; style: CategoriesStyle };
  catalog: { title: string };
  gallery: { title: string; images: string[]; style: GalleryStyle; useProductPhotos: boolean };
  logos: { title: string; images: string[] };
  testimonials: { title: string; items: { quote: string; author: string }[] };
  locations: { title: string; subtitle: string; items: { name: string; address: string }[] };
  about: { title: string; eyebrow: string; text: string; image: string; style: AboutStyle };
  faq: { title: string; items: { q: string; a: string }[] };
  imageText: {
    title: string;
    text: string;
    image: string;
    ctaText: string;
    ctaLink: string;
    imageSide: "izquierda" | "derecha";
  };
  banner: { title: string; text: string; ctaText: string; ctaLink: string; image: string; tone: BannerTone };
  whatsapp: { title: string; text: string; ctaText: string };
}

export type SectionType = keyof SectionSettingsMap;

export interface Section<T extends SectionType = SectionType> {
  /** Único dentro del diseño. Lo usa el editor para seleccionarla. */
  id: string;
  type: T;
  hidden?: boolean;
  settings: SectionSettingsMap[T];
}

/** Una sección de cualquier tipo, con sus ajustes ya del tipo correcto. */
export type AnySection = { [T in SectionType]: Section<T> }[SectionType];
