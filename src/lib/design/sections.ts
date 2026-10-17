import { z } from "zod";

import type {
  AnySection,
  HeroStyle,
  Section,
  SectionSettingsMap,
  SectionType,
} from "@/lib/design/types";

/**
 * El catálogo de secciones: qué hay, cómo se llama, qué se puede configurar y
 * qué plan lo incluye.
 *
 * Es la única fuente de verdad. De acá salen tres cosas: el formulario del
 * editor (se arma solo a partir de `fields`), la validación del servidor (el
 * esquema zod se deriva de los mismos campos) y lo que la IA puede tocar.
 * Agregar una sección es agregarla acá y escribir su componente.
 */

export type FieldSpec =
  | { kind: "text"; key: string; label: string; max: number; placeholder?: string; help?: string; when?: When }
  | { kind: "textarea"; key: string; label: string; max: number; rows?: number; placeholder?: string; help?: string; when?: When }
  | { kind: "select"; key: string; label: string; options: SelectOption[]; help?: string; when?: When }
  | { kind: "toggle"; key: string; label: string; help?: string; when?: When }
  | { kind: "number"; key: string; label: string; min: number; max: number; when?: When }
  | { kind: "images"; key: string; label: string; max: number; help?: string; when?: When }
  | { kind: "image"; key: string; label: string; help?: string; when?: When }
  | { kind: "category"; key: string; label: string; when?: When }
  | { kind: "link"; key: string; label: string; help?: string; when?: When }
  | {
      kind: "items";
      key: string;
      label: string;
      itemLabel: string;
      max: number;
      fields: ItemField[];
      help?: string;
      when?: When;
    };

export interface SelectOption {
  value: string;
  label: string;
  /** Solo con Pro. */
  pro?: boolean;
}

export interface ItemField {
  key: string;
  label: string;
  kind: "text" | "textarea";
  max: number;
  placeholder?: string;
}

/** Mostrar el campo solo si los ajustes cumplen esto (ej. categoría solo si la fuente es "categoría"). */
type When = (settings: Record<string, unknown>) => boolean;

export interface SectionDef<T extends SectionType = SectionType> {
  type: T;
  label: string;
  description: string;
  /** Nombre de ícono de lucide (el editor lo resuelve). */
  icon: string;
  /** Solo en Pro. */
  pro: boolean;
  /** Solo puede haber una (ej. el catálogo). */
  single?: boolean;
  /** No se puede quitar ni ocultar. */
  required?: boolean;
  fields: FieldSpec[];
  defaults: () => SectionSettingsMap[T];
}

export const HERO_STYLES: { value: HeroStyle; label: string; pro?: boolean }[] = [
  { value: "auto", label: "La del estilo de la tienda" },
  { value: "clasico", label: "Clásica (color de marca o foto)" },
  { value: "editorial", label: "Editorial a pantalla completa" },
  { value: "atleta", label: "Revista, foto grande", pro: true },
  { value: "urbano", label: "Urbana, con video o carrusel", pro: true },
  { value: "minimal", label: "Minimalista, centrada" },
  { value: "suave", label: "Suave, colores pastel" },
  { value: "dividido", label: "Texto e imagen lado a lado", pro: true },
  { value: "buscador", label: "Con buscador grande" },
  { value: "promo", label: "Tarjeta de promoción", pro: true },
  { value: "energetico", label: "Energética, en diagonal" },
  { value: "campana", label: "Campaña con contador", pro: true },
];

const LINK_HELP =
  "Vacío = baja al catálogo. Puede ser una categoría (?cat=zapatos), un producto (/producto/nombre) o un enlace completo.";

const heroStyleIs = (...styles: HeroStyle[]): When => (s) =>
  styles.includes(s.style as HeroStyle);

export const SECTION_DEFS: { [T in SectionType]: SectionDef<T> } = {
  hero: {
    type: "hero",
    label: "Portada",
    description: "Lo primero que se ve: titular, frase y botón, con foto, carrusel o video.",
    icon: "image",
    pro: false,
    fields: [
      { kind: "select", key: "style", label: "Diseño de la portada", options: HERO_STYLES },
      { kind: "text", key: "headline", label: "Titular", max: 140, placeholder: "Bienvenido a tu tienda" },
      { kind: "text", key: "subtext", label: "Frase", max: 240, placeholder: "Una frase corta de tu tienda" },
      { kind: "text", key: "ctaText", label: "Texto del botón", max: 40, placeholder: "Ver productos" },
      { kind: "link", key: "ctaLink", label: "El botón lleva a", help: LINK_HELP },
      {
        kind: "images",
        key: "images",
        label: "Fotos de la portada",
        max: 5,
        help: "Si pones varias, rotan. Sin fotos se usa el banner de la tienda.",
        when: (s) => !heroStyleIs("buscador", "minimal", "suave")(s),
      },
      {
        kind: "text",
        key: "videoUrl",
        label: "Video de portada (enlace .mp4)",
        max: 400,
        placeholder: "https://…/video.mp4",
        help: "Si lo pones, reemplaza las fotos.",
        when: heroStyleIs("urbano"),
      },
      { kind: "toggle", key: "showStoreName", label: "Mostrar el nombre de la tienda arriba del titular" },
      { kind: "toggle", key: "countdown", label: "Mostrar contador del drop", when: heroStyleIs("campana") },
    ],
    defaults: () => ({
      style: "auto",
      headline: "",
      subtext: "",
      ctaText: "",
      ctaLink: "",
      images: [],
      videoUrl: "",
      showStoreName: true,
      countdown: true,
    }),
  },

  benefits: {
    type: "benefits",
    label: "Beneficios",
    description: "Delivery, retiro, precios en USD y Bs: se arma solo con tus datos.",
    icon: "badge-check",
    pro: false,
    single: true,
    fields: [],
    defaults: () => ({ title: "" }),
  },

  products: {
    type: "products",
    label: "Productos",
    description: "Una fila o grilla de productos: destacados, lo más nuevo, combos o una categoría.",
    icon: "shopping-bag",
    pro: false,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Destacados" },
      { kind: "text", key: "subtitle", label: "Subtítulo", max: 200 },
      {
        kind: "select",
        key: "source",
        label: "Qué productos",
        options: [
          { value: "destacados", label: "Los que marcaste como destacados" },
          { value: "recientes", label: "Lo más nuevo" },
          { value: "combos", label: "Combos, sets y kits" },
          { value: "categoria", label: "Una categoría" },
        ],
      },
      { kind: "category", key: "category", label: "Categoría", when: (s) => s.source === "categoria" },
      {
        kind: "select",
        key: "layout",
        label: "Cómo se muestran",
        options: [
          { value: "carrusel", label: "Fila que se desliza" },
          { value: "grilla", label: "Grilla" },
        ],
      },
      { kind: "number", key: "limit", label: "Cuántos productos", min: 2, max: 12 },
      { kind: "toggle", key: "viewAll", label: "Botón \"Ver todo\"" },
      { kind: "toggle", key: "accent", label: "Resaltar el título con el color de acento" },
    ],
    defaults: () => ({
      title: "Destacados",
      subtitle: "",
      source: "destacados",
      category: "",
      layout: "carrusel",
      limit: 10,
      viewAll: false,
      accent: false,
    }),
  },

  collections: {
    type: "collections",
    label: "Colecciones",
    description: "Una fila por cada categoría, con su botón \"Ver todo\".",
    icon: "rows",
    pro: true,
    single: true,
    fields: [],
    defaults: () => ({ title: "" }),
  },

  categories: {
    type: "categories",
    label: "Categorías",
    description: "Botones para entrar a cada categoría.",
    icon: "tags",
    pro: false,
    single: true,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Categorías" },
      {
        kind: "select",
        key: "style",
        label: "Diseño",
        options: [
          { value: "auto", label: "El del estilo de la tienda" },
          { value: "pastillas", label: "Pastillas" },
          { value: "circulos", label: "Círculos con iniciales" },
          { value: "carrusel", label: "Carrusel grande" },
        ],
      },
    ],
    defaults: () => ({ title: "Categorías", style: "auto" }),
  },

  catalog: {
    type: "catalog",
    label: "Catálogo",
    description: "Todos tus productos, con búsqueda y filtros por categoría.",
    icon: "layout-grid",
    pro: false,
    single: true,
    required: true,
    fields: [{ kind: "text", key: "title", label: "Título", max: 80, placeholder: "Todos los productos" }],
    defaults: () => ({ title: "Todos los productos" }),
  },

  gallery: {
    type: "gallery",
    label: "Galería",
    description: "Fotos de ambiente, lookbook o tu local.",
    icon: "images",
    // Gratis: la plantilla Moda (del plan Gratis) ya traía su lookbook.
    pro: false,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Galería" },
      { kind: "images", key: "images", label: "Fotos", max: 8 },
      {
        kind: "toggle",
        key: "useProductPhotos",
        label: "Sin fotos propias, usar las de los productos",
      },
      {
        kind: "select",
        key: "style",
        label: "Diseño",
        options: [
          { value: "auto", label: "El del estilo de la tienda" },
          { value: "grilla", label: "Grilla pareja" },
          { value: "mosaico", label: "Mosaico con una foto grande" },
        ],
      },
    ],
    defaults: () => ({ title: "Galería", images: [], style: "auto", useProductPhotos: true }),
  },

  logos: {
    type: "logos",
    label: "Logos",
    description: "Medios, marcas o aliados que te respaldan.",
    icon: "award",
    pro: true,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Nos recomiendan" },
      { kind: "images", key: "images", label: "Logos", max: 8, help: "Se muestran en gris y toman color al pasar el mouse." },
    ],
    defaults: () => ({ title: "Nos recomiendan", images: [] }),
  },

  testimonials: {
    type: "testimonials",
    label: "Testimonios",
    description: "Lo que dicen tus clientes de verdad.",
    icon: "quote",
    pro: true,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Lo que dicen de nosotros" },
      {
        kind: "items",
        key: "items",
        label: "Testimonios",
        itemLabel: "Testimonio",
        max: 12,
        help: "Usa testimonios reales de tus clientes.",
        fields: [
          { key: "quote", label: "Lo que dijo", kind: "textarea", max: 400 },
          { key: "author", label: "Nombre", kind: "text", max: 80 },
        ],
      },
    ],
    defaults: () => ({ title: "Lo que dicen de nosotros", items: [] }),
  },

  locations: {
    type: "locations",
    label: "Nuestras tiendas",
    description: "Tus locales físicos, con dirección.",
    icon: "map-pin",
    pro: true,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Nuestras tiendas" },
      { kind: "text", key: "subtitle", label: "Subtítulo", max: 200, placeholder: "Ven a conocernos" },
      {
        kind: "items",
        key: "items",
        label: "Locales",
        itemLabel: "Local",
        max: 20,
        fields: [
          { key: "name", label: "Nombre", kind: "text", max: 80 },
          { key: "address", label: "Dirección", kind: "text", max: 200 },
        ],
      },
    ],
    defaults: () => ({ title: "Nuestras tiendas", subtitle: "", items: [] }),
  },

  about: {
    type: "about",
    label: "Sobre nosotros",
    description: "La historia de tu marca, con foto opcional.",
    icon: "book-open",
    pro: false,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Sobre nosotros" },
      { kind: "text", key: "eyebrow", label: "Texto chico arriba del título", max: 80 },
      { kind: "textarea", key: "text", label: "Texto", max: 2000, rows: 5, placeholder: "Cuenta la historia de tu tienda…" },
      { kind: "image", key: "image", label: "Foto", help: "Se ve en el diseño \"Texto y foto\"." },
      {
        kind: "select",
        key: "style",
        label: "Diseño",
        options: [
          { value: "auto", label: "El del estilo de la tienda" },
          { value: "tarjeta", label: "Tarjeta" },
          { value: "centrado", label: "Centrado" },
          { value: "banda", label: "Banda de color", pro: true },
          { value: "archivo", label: "Archivo", pro: true },
          { value: "dividido", label: "Texto y foto", pro: true },
        ],
      },
    ],
    defaults: () => ({ title: "Sobre nosotros", eyebrow: "", text: "", image: "", style: "auto" }),
  },

  faq: {
    type: "faq",
    label: "Preguntas frecuentes",
    description: "Envíos, pagos, cambios: lo que más te preguntan por WhatsApp.",
    icon: "circle-help",
    pro: false,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "Preguntas frecuentes" },
      {
        kind: "items",
        key: "items",
        label: "Preguntas",
        itemLabel: "Pregunta",
        max: 20,
        fields: [
          { key: "q", label: "Pregunta", kind: "text", max: 160, placeholder: "¿Hacen envíos?" },
          { key: "a", label: "Respuesta", kind: "textarea", max: 800 },
        ],
      },
    ],
    defaults: () => ({ title: "Preguntas frecuentes", items: [] }),
  },

  imageText: {
    type: "imageText",
    label: "Imagen con texto",
    description: "Una foto grande al lado de un texto y un botón.",
    icon: "panel-left",
    pro: true,
    fields: [
      { kind: "image", key: "image", label: "Foto" },
      { kind: "text", key: "title", label: "Título", max: 80 },
      { kind: "textarea", key: "text", label: "Texto", max: 800, rows: 4 },
      { kind: "text", key: "ctaText", label: "Texto del botón", max: 40, help: "Vacío = sin botón." },
      { kind: "link", key: "ctaLink", label: "El botón lleva a", help: LINK_HELP },
      {
        kind: "select",
        key: "imageSide",
        label: "La foto va a la",
        options: [
          { value: "izquierda", label: "Izquierda" },
          { value: "derecha", label: "Derecha" },
        ],
      },
    ],
    defaults: () => ({ title: "", text: "", image: "", ctaText: "", ctaLink: "", imageSide: "izquierda" }),
  },

  banner: {
    type: "banner",
    label: "Banner de promoción",
    description: "Una franja llamativa para una oferta o un anuncio.",
    icon: "megaphone",
    pro: true,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "20% en toda la tienda" },
      { kind: "text", key: "text", label: "Texto", max: 200 },
      { kind: "text", key: "ctaText", label: "Texto del botón", max: 40, help: "Vacío = sin botón." },
      { kind: "link", key: "ctaLink", label: "El botón lleva a", help: LINK_HELP },
      { kind: "image", key: "image", label: "Foto de fondo (opcional)" },
      {
        kind: "select",
        key: "tone",
        label: "Color",
        options: [
          { value: "marca", label: "Color de marca" },
          { value: "acento", label: "Color de acento" },
          { value: "oscuro", label: "Oscuro" },
        ],
      },
    ],
    defaults: () => ({ title: "", text: "", ctaText: "", ctaLink: "", image: "", tone: "marca" }),
  },

  whatsapp: {
    type: "whatsapp",
    label: "Botón de WhatsApp",
    description: "Una invitación grande a escribirte por WhatsApp.",
    icon: "message-circle",
    pro: false,
    fields: [
      { kind: "text", key: "title", label: "Título", max: 80, placeholder: "¿Tienes dudas?" },
      { kind: "text", key: "text", label: "Texto", max: 200, placeholder: "Escríbenos y te ayudamos a elegir." },
      { kind: "text", key: "ctaText", label: "Texto del botón", max: 40, placeholder: "Escríbenos por WhatsApp" },
    ],
    defaults: () => ({
      title: "¿Tienes dudas?",
      text: "Escríbenos y te ayudamos a elegir.",
      ctaText: "Escríbenos por WhatsApp",
    }),
  },
};

export const SECTION_TYPES = Object.keys(SECTION_DEFS) as SectionType[];

/** Una sección nueva con sus valores por defecto. */
export function newSection<T extends SectionType>(type: T, id?: string): Section<T> {
  return {
    id: id ?? newSectionId(),
    type,
    settings: SECTION_DEFS[type].defaults() as SectionSettingsMap[T],
  };
}

export function newSectionId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ─── Validación ────────────────────────────────────────────────────────────

function fieldSchema(f: FieldSpec): z.ZodTypeAny {
  switch (f.kind) {
    case "text":
    case "textarea":
      return z.string().max(f.max);
    case "link":
      return z.string().max(400);
    case "select":
      return z.enum(f.options.map((o) => o.value) as [string, ...string[]]);
    case "toggle":
      return z.boolean();
    case "number":
      return z.number().int().min(f.min).max(f.max);
    case "images":
      return z.array(z.string().max(400)).max(f.max);
    case "image":
    case "category":
      return z.string().max(400);
    case "items":
      return z
        .array(
          z.object(
            Object.fromEntries(f.fields.map((i) => [i.key, z.string().max(i.max)])),
          ),
        )
        .max(f.max);
  }
}

/**
 * Esquema de los ajustes de cada tipo. Los campos que el editor no expone
 * (ej. el título de Beneficios) se validan con el tipo de su valor por defecto.
 */
function settingsSchema(def: SectionDef): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  const defaults = def.defaults() as Record<string, unknown>;
  for (const [key, value] of Object.entries(defaults)) {
    const field = def.fields.find((f) => f.key === key);
    shape[key] = field
      ? fieldSchema(field)
      : typeof value === "boolean"
        ? z.boolean()
        : typeof value === "number"
          ? z.number()
          : z.string().max(400);
  }
  return z.object(shape);
}

const SETTINGS_SCHEMAS = Object.fromEntries(
  SECTION_TYPES.map((t) => [t, settingsSchema(SECTION_DEFS[t] as SectionDef)]),
) as Record<SectionType, z.ZodTypeAny>;

export const sectionSchema = z
  .object({
    id: z.string().min(1).max(40),
    type: z.enum(SECTION_TYPES as [SectionType, ...SectionType[]]),
    hidden: z.boolean().optional(),
    settings: z.record(z.string(), z.unknown()),
  })
  .superRefine((s, ctx) => {
    const res = SETTINGS_SCHEMAS[s.type].safeParse(s.settings);
    if (!res.success) {
      ctx.addIssue({
        code: "custom",
        message: `${SECTION_DEFS[s.type].label}: ${res.error.issues[0]?.message ?? "ajustes inválidos"}`,
      });
    }
  });

/**
 * Completa los ajustes que falten con los valores por defecto. Un diseño
 * guardado con una versión vieja del catálogo (antes de que existiera un campo)
 * sigue siendo válido y se ve bien.
 */
export function normalizeSection(raw: unknown): AnySection | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { id?: unknown; type?: unknown; hidden?: unknown; settings?: unknown };
  if (typeof r.type !== "string" || !(r.type in SECTION_DEFS)) return null;
  const type = r.type as SectionType;
  const defaults = SECTION_DEFS[type].defaults() as Record<string, unknown>;
  const saved = (r.settings && typeof r.settings === "object" ? r.settings : {}) as Record<string, unknown>;
  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    const v = saved[key];
    settings[key] =
      v !== undefined && typeof v === typeof value && Array.isArray(v) === Array.isArray(value)
        ? v
        : value;
  }
  return {
    id: typeof r.id === "string" && r.id ? r.id.slice(0, 40) : newSectionId(),
    type,
    hidden: r.hidden === true ? true : undefined,
    settings,
  } as AnySection;
}
