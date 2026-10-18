import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { isPro, type PlanFields } from "@/lib/plans";
import { BASES, baseNeedsPro, getBase, type DesignPatch } from "@/lib/design/bases";
import { HEADING_FONTS } from "@/lib/design/design";
import type { HeadingFont } from "@/lib/design/types";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_LAYOUTS,
  LAYOUT_BLOCKS,
  LAYOUT_IDS,
  THEME_FONTS,
  THEME_PRESETS,
  seedBlocks,
  type ButtonStyle,
  type CardStyle,
  type LayoutId,
  type SectionId,
  type StoreTheme,
  type ThemeFont,
} from "@/lib/theme";

/**
 * El diseñador con IA: el comerciante cuenta de su negocio en sus palabras y
 * Claude le arma tres propuestas de tienda sobre el esquema de diseño que ya
 * existe (plantilla, colores, fuente, textos y títulos de las secciones).
 *
 * La IA no escribe código ni HTML: devuelve datos, y esos datos se guardan con
 * la misma acción y las mismas validaciones que el editor de Personalizar. Lo
 * peor que puede salir es un diseño que no le guste, nunca una tienda rota.
 */

export const AI_DESIGN_MODEL = "claude-opus-5-5";

/**
 * Generaciones por tienda cada 24 h, para todos los planes. Cada una cuesta
 * alrededor de US$0,25 (tres propuestas en una sola llamada), y el plan Pro
 * vale US$5 al mes: sin tope, un comerciante curioso se come el margen en una
 * tarde. Los intentos que fallan también cuentan, para que un error repetido no
 * sea una puerta para gastar sin límite.
 */
export const AI_DESIGN_DAILY_LIMIT = 5;

/**
 * Diseños con IA que trae el plan Gratis, de por vida: la prueba para que vea
 * lo que hace la IA. Solo cuentan los que salieron bien; un error nuestro no le
 * gasta su única oportunidad.
 */
export const AI_DESIGN_FREE_LIMIT = 1;

/** Sin la clave de Anthropic el diseñador no aparece en ningún lado. */
export function aiDesignAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface AiDesignQuota {
  /** Generaciones que puede pedir ahora mismo. */
  remaining: number;
  pro: boolean;
  /** Gratis y ya usó su diseño de prueba: lo que sigue es pasarse a Pro. */
  freeUsed: boolean;
}

/**
 * Cuántas generaciones le quedan a la tienda según su plan.
 *
 * null = no se puede saber (la migración 0032 no está corrida). Se trata como
 * "no disponible": sin la cuenta no hay tope, y cada intento cuesta plata.
 */
export async function aiDesignQuota(
  store: { id: string } & Partial<PlanFields>,
): Promise<AiDesignQuota | null> {
  const db = createAdminClient();
  const pro = isPro(store);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // La tabla la comparte la carga de productos con fotos: solo cuentan los diseños.
  const [today, everOk] = await Promise.all([
    db
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("kind", "design")
      .gte("created_at", since),
    pro
      ? null
      : db
          .from("ai_generations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", store.id)
          .eq("kind", "design")
          .eq("ok", true),
  ]);
  const error = today.error ?? everOk?.error;
  if (error) {
    reportError("aiDesignQuota", new Error(error.message), { storeId: store.id });
    return null;
  }

  const leftToday = Math.max(0, AI_DESIGN_DAILY_LIMIT - (today.count ?? 0));
  if (pro) return { remaining: leftToday, pro, freeUsed: false };

  const leftFree = Math.max(0, AI_DESIGN_FREE_LIMIT - (everOk?.count ?? 0));
  return { remaining: Math.min(leftToday, leftFree), pro, freeUsed: leftFree === 0 };
}

async function recordGeneration(row: {
  storeId: string;
  ok: boolean;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const { error } = await createAdminClient().from("ai_generations").insert({
    store_id: row.storeId,
    kind: "design",
    model: AI_DESIGN_MODEL,
    input_tokens: row.inputTokens,
    output_tokens: row.outputTokens,
    ok: row.ok,
  });
  if (error) reportError("recordGeneration", new Error(error.message), { storeId: row.storeId });
}

/** Lo que se sabe de la tienda, además de lo que el comerciante escribió. */
export interface DesignContext {
  brief: string;
  storeName: string;
  pro: boolean;
  description: string | null;
  address: string | null;
  instagram: string | null;
  offersDelivery: boolean;
  deliveryNote: string | null;
  offersPickup: boolean;
  freeDeliveryMin: number | null;
  showBsPrices: boolean;
  paymentMethods: string[];
  categories: string[];
  products: string[];
  /** URLs públicas: el logo primero, después fotos de productos. */
  images: { url: string; kind: "logo" | "product" }[];
}

export interface DesignProposal {
  name: string;
  rationale: string;
  /** Para la descripción de la tienda (Google y el enlace compartido). */
  description: string;
  /** La dirección de arte que le tocó, para no repetirla la próxima vez. */
  direction?: string;
  /** El diseño base (editor nuevo) o la plantilla (editor viejo) que usa. */
  design: string;
  colors: { primary: string; accent: string; surface: string };
  /** Editor viejo: el tema completo, listo para la vista previa y para guardar. */
  theme?: StoreTheme;
  /** Editor por secciones: el cambio que se ve en la vista previa real y se aplica al borrador. */
  patch?: DesignPatch;
}

/**
 * Lo que el comerciante ya vio en intentos anteriores. Lo guarda su navegador
 * y viaja con cada pedido: así la IA sabe qué no repetir sin guardar nada más
 * en la base.
 */
export interface SeenProposal {
  name: string;
  design: string;
  colors: { primary: string; accent: string; surface: string };
  direction?: string;
}

export const seenSchema = z
  .array(
    z.object({
      name: z.string().max(60),
      design: z.string().max(40),
      colors: z.object({ primary: z.string().max(7), accent: z.string().max(7), surface: z.string().max(7) }),
      direction: z.string().max(40).optional(),
    }),
  )
  .max(12);

export type GenerateDesignResult =
  | { ok: true; proposals: DesignProposal[] }
  | { ok: false; error: string };

/**
 * Cuándo conviene cada plantilla. `Record` completo a propósito: si se agrega
 * un layout y nadie le escribe su guía, esto no compila y la IA no queda
 * eligiendo a ciegas.
 */
const LAYOUT_GUIDE: Record<LayoutId, string> = {
  classic:
    "Versátil y directa: portada con el color de marca, franja de beneficios (delivery, pago en USD y Bs) y catálogo. Sirve para cualquier rubro; la mejor para variedades, comida, hogar, ferretería o servicios.",
  fashion:
    "Moda minimalista y editorial, encabezado oscuro y letras espaciadas. Ropa y calzado.",
  "fashion-athletic":
    "Ropa premium con aire de revista: carrusel grande, galería lifestyle y logos de prensa. Marcas de ropa con buenas fotos.",
  "fashion-streetwear":
    "Urbano y de comunidad: títulos gruesos en mayúsculas, colecciones por categoría, reseñas y locales. Streetwear, sneakers, marcas jóvenes.",
  accessories:
    "Elegante, títulos con serif y mucho blanco. Joyería, relojes, carteras, lentes.",
  beauty:
    "Suave y amable, colores pastel. Cosmética, cuidado personal, salud y bienestar.",
  "beauty-minimal":
    "Premium y con mucho aire, manifiesto de marca y combos. Skincare y maquillaje, sobre todo de marca propia.",
  tech:
    "Alto contraste, encabezado oscuro y líneas marcadas. Electrónica, celulares, accesorios tech, gaming.",
  "tech-discover":
    "Estilo app moderna: tarjetas redondeadas, banner de promo y categorías en pastillas. Gadgets y tiendas con mucho catálogo.",
  sports:
    "Energético, títulos condensados en mayúsculas. Artículos deportivos, suplementos, gimnasio.",
  "sports-drops":
    "Oscuro con acento neón, estética de lanzamientos y coleccionables, con contador. Camisetas de fútbol, sneakers de edición limitada, coleccionables.",
};

const FONT_GUIDE: Record<ThemeFont, string> = {
  inter: "neutra y moderna",
  poppins: "redondeada y amable",
  montserrat: "geométrica y con fuerza",
  lora: "serif elegante",
  dmsans: "limpia y sobria",
  nunito: "redondeada y cercana",
  outfit: "moderna y geométrica",
};

/**
 * Direcciones de arte. El modelo no tiene un control de azar, así que la
 * variedad se fuerza desde acá: en cada intento se sortean dos y se le pide
 * una propuesta por dirección. Mismo comerciante, mismo texto, ideas nuevas.
 */
const ART_DIRECTIONS: { id: string; name: string; brief: string }[] = [
  { id: "minimal", name: "Minimalista premium", brief: "mucho blanco, una sola tinta oscura, letras finas y nada que sobre" },
  { id: "plenos", name: "Colores plenos", brief: "un color fuerte de marca, contraste alto y mucha seguridad" },
  { id: "editorial", name: "Editorial de revista", brief: "serif elegante en los títulos, fotos protagonistas y tonos sobrios" },
  { id: "calido", name: "Cálido y artesanal", brief: "tierra, crema, terracota y verdes apagados: se siente hecho a mano" },
  { id: "oscuro", name: "Oscuro elegante", brief: "fondo casi negro, texto claro y un acento metálico o vibrante" },
  { id: "juvenil", name: "Fresco y juvenil", brief: "colores alegres, formas redondeadas y letras grandes y amables" },
  { id: "tecnico", name: "Técnico y preciso", brief: "azules fríos o grafito, mayúsculas, líneas marcadas y orden" },
  { id: "natural", name: "Natural", brief: "verdes, beige y blancos rotos: tranquilo y orgánico" },
  { id: "retro", name: "Retro", brief: "mostaza, vino y crema, títulos con carácter, guiño a los 70" },
  { id: "lujo", name: "Lujo discreto", brief: "negro, marfil y un dorado suave, serif y mucho aire" },
  { id: "pastel", name: "Pastel suave", brief: "rosados, lilas o menta en tonos suaves, cercano y delicado" },
  { id: "urbano", name: "Urbano", brief: "negro con un neón o un color ácido y títulos gruesos condensados" },
  { id: "tropical", name: "Tropical caribeño", brief: "verde intenso, coral y amarillo: alegría y sol venezolano" },
  { id: "mono", name: "Monocromático", brief: "un solo color en varias intensidades, muy limpio" },
  { id: "confiable", name: "Clásico confiable", brief: "un azul o verde de marca, blanco y todo muy ordenado" },
  { id: "contraste", name: "Contraste inesperado", brief: "dos colores complementarios que nadie espera juntos, pero funcionan" },
];

/** Dos direcciones al azar que no haya visto hace poco (si quedan). */
function pickDirections(seen: SeenProposal[], n = 2) {
  const recent = new Set(seen.map((s) => s.direction).filter(Boolean));
  const fresh = ART_DIRECTIONS.filter((d) => !recent.has(d.id));
  const pool = [...(fresh.length >= n ? fresh : ART_DIRECTIONS)];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

/** El pedido de variedad y memoria que va en cada mensaje, igual para los dos editores. */
function varietyNote(directions: { name: string; brief: string }[], seen: SeenProposal[]): string {
  const lines = [
    "## Cómo repartir las tres propuestas",
    "- Propuesta 1: la que mejor le queda según lo que contó.",
    ...directions.map((d, i) => `- Propuesta ${i + 2}: dirección "${d.name}" (${d.brief}). Adáptala a su negocio sin perder la idea.`),
    "- Que se note la diferencia entre las tres: otra paleta, otras fuentes, otra estructura.",
    "- Como mucho una de las tres puede usar los colores del logo; las otras exploran.",
  ];
  if (seen.length) {
    lines.push(
      "",
      "## Ya le mostraste estas (no las repitas ni hagas algo parecido)",
      ...seen.map((s) => `- ${s.name}: ${s.design}, colores ${s.colors.primary} / ${s.colors.accent} / ${s.colors.surface}`),
    );
  }
  return lines.join("\n");
}

const FIELD_LABEL = { title: "título", subtitle: "subtítulo", body: "texto largo" } as const;

function templateCatalog(): string {
  return THEME_PRESETS.filter((p) => LAYOUT_IDS.includes(p.id as LayoutId))
    .map((p) => {
      const id = p.id as LayoutId;
      const blocks = (LAYOUT_BLOCKS[id] ?? [])
        .filter((b) => b.fields.length > 0)
        .map((b) => `${b.id} (${b.label}: ${b.fields.map((f) => FIELD_LABEL[f]).join(", ")})`);
      const sections = blocks.length
        ? `\n  Secciones con texto propio: ${blocks.join("; ")}.`
        : "\n  Sin títulos de sección propios (usa sectionTitles vacío).";
      return `- ${id} · ${p.label}: ${LAYOUT_GUIDE[id]}${sections}`;
    })
    .join("\n");
}

const SYSTEM_PROMPT = `Eres el diseñador de tiendas de Tiendify, una plataforma venezolana para vender por internet. Los comerciantes venden sobre todo por WhatsApp e Instagram, y sus clientes compran desde el teléfono, pagando en dólares o en bolívares (pago móvil, Zelle, transferencia, efectivo).

El comerciante te cuenta de su negocio y tú le propones tres diseños de tienda. Cada diseño elige una plantilla, colores, fuente, estilo de botones y tarjetas, y escribe todos los textos de la página de inicio.

## Plantillas
${templateCatalog()}

Usa solo las plantillas que te indiquen como disponibles en el mensaje.

## Colores (hex #RRGGBB)
- surface: el fondo de toda la tienda. Claro (blanco, crema, gris muy suave) salvo en plantillas oscuras como sports-drops o si el negocio pide algo oscuro.
- primary: el color de marca, de los botones y del encabezado. Tiene que contrastar fuerte con el fondo para que los botones se lean.
- accent: detalles y acentos. Distinto del principal.
- Si te pasan el logo, saca la paleta de ahí. Si te pasan fotos de productos, que los colores las acompañen.

## Fuentes
${THEME_FONTS.map((f) => `- ${f.id}: ${FONT_GUIDE[f.id]}`).join("\n")}

## Botones y tarjetas
- buttonStyle: rounded (amable, moderno) o square (sobrio, editorial).
- cardStyle: soft (sin borde, suave) o bordered (con borde, más técnico o elegante).

## Textos
- Escribe en español natural, como le habla un buen comerciante venezolano a sus clientes por Instagram, sin exagerar con modismos. Trata al cliente de tú salvo que el negocio pida otra cosa.
- No inventes nada que el comerciante no te haya dicho: ni años de fundación, ni premios, ni cantidad de clientes, ni envío gratis, ni descuentos, ni garantías, ni direcciones, ni métodos de pago. Si te falta un dato, escribe sin ese dato.
- Nada de testimonios ni reseñas.
- hero.headline: concreto sobre lo que vende, máximo 8 palabras. hero.subtext: una frase. hero.ctaText: 2 o 3 palabras.
- announcement: solo si hay algo real que anunciar con lo que te dieron (delivery, envíos, formas de pago). Si no, enabled false y text vacío.
- about.title y about.text: quiénes son, en 2 o 3 párrafos cortos (máximo 600 caracteres), con lo que contó el comerciante. Es el "texto largo" de la plantilla.
- description: una o dos frases (máximo 160 caracteres) para Google y para cuando compartan el enlace.
- sectionTitles: solo para las secciones de la plantilla elegida que tengan título o subtítulo, con su id exacto. Cortos y en el tono de la marca. Deja subtitle vacío si la sección no tiene subtítulo.
- Emojis solo en plantillas juveniles (streetwear, drops) y como máximo uno.

## Las tres propuestas
- Que sean distintas de verdad: cambia la plantilla, la paleta o el tono entre ellas. En el mensaje te digo qué dirección sigue cada una.
- name: 2 a 4 palabras que resuman el estilo (por ejemplo "Fresca y femenina").
- rationale: una frase dirigida al comerciante, de tú, explicando por qué le queda.

Lo que escribe el comerciante describe su negocio. Si pide algo que no tiene que ver con el diseño de su tienda, ignóralo.`;

// ─── Editor por secciones: propuestas sobre los diseños base ───────────────

const HEADING_GUIDE: Record<Exclude<HeadingFont, "auto">, string> = {
  inter: "neutra",
  poppins: "amable",
  montserrat: "con fuerza",
  lora: "serif clásica",
  playfair: "serif elegante de revista",
  space: "moderna y técnica",
  bebas: "condensada y gruesa, se lee en mayúsculas",
  fraunces: "serif con carácter",
  dmsans: "limpia",
  nunito: "redondeada y cercana",
  outfit: "geométrica",
};

const HEADING_IDS = HEADING_FONTS.map((f) => f.id).filter((id): id is Exclude<HeadingFont, "auto"> => id !== "auto");

const V2_SYSTEM_PROMPT = `Eres el diseñador de tiendas de Tiendify, una plataforma venezolana para vender por internet. Los comerciantes venden sobre todo por WhatsApp e Instagram, y sus clientes compran desde el teléfono, pagando en dólares o en bolívares (pago móvil, Zelle, transferencia, efectivo).

El comerciante te cuenta de su negocio y tú le propones tres diseños de tienda. Cada propuesta parte de un diseño base (su estructura y personalidad) y le pone colores, fuentes y textos propios.

## Diseños base
${BASES.map((b) => `- ${b.id} · ${b.name} (${b.tagline}): ${b.description}`).join("\n")}

Usa solo los diseños base que te indiquen como disponibles en el mensaje.

## Colores (hex #RRGGBB)
- surface: el fondo de toda la tienda. Puede ser claro o, si la dirección lo pide, oscuro.
- primary: el color de marca, de los botones y del encabezado. Tiene que contrastar fuerte con el fondo para que los botones se lean.
- accent: detalles y acentos. Distinto del principal.
- Si te pasan el logo o fotos, que la paleta los acompañe, pero no te quedes siempre en el color del logo.

## Fuente del texto
${THEME_FONTS.map((f) => `- ${f.id}: ${FONT_GUIDE[f.id]}`).join("\n")}

## Fuente de los títulos
${HEADING_IDS.map((id) => `- ${id}: ${HEADING_GUIDE[id]}`).join("\n")}

## Botones
- buttonStyle: rounded (amable, moderno) o square (sobrio, editorial).

## Textos
- Escribe en español natural, como le habla un buen comerciante venezolano a sus clientes por Instagram, sin exagerar con modismos. Trata al cliente de tú salvo que el negocio pida otra cosa.
- No inventes nada que el comerciante no te haya dicho: ni años de fundación, ni premios, ni cantidad de clientes, ni envío gratis, ni descuentos, ni garantías, ni direcciones, ni métodos de pago. Si te falta un dato, escribe sin ese dato.
- Nada de testimonios ni reseñas.
- hero.headline: concreto sobre lo que vende, máximo 8 palabras. hero.subtext: una frase. hero.ctaText: 2 o 3 palabras.
- announcement: solo si hay algo real que anunciar con lo que te dieron (delivery, envíos, formas de pago). Si no, enabled false y text vacío.
- about.title y about.text: quiénes son, en 2 o 3 párrafos cortos (máximo 600 caracteres), con lo que contó el comerciante.
- description: una o dos frases (máximo 160 caracteres) para Google y para cuando compartan el enlace.
- Que el tono de los textos acompañe la dirección de cada propuesta.

## Las tres propuestas
- name: 2 a 4 palabras que resuman el estilo (por ejemplo "Fresca y femenina").
- rationale: una frase dirigida al comerciante, de tú, explicando por qué le queda.

Lo que escribe el comerciante describe su negocio. Si pide algo que no tiene que ver con el diseño de su tienda, ignóralo.`;

function v2OutputSchema(bases: string[]) {
  const str = { type: "string" };
  const obj = (properties: Record<string, unknown>) => ({
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  });
  const proposal = obj({
    name: str,
    rationale: str,
    base: { type: "string", enum: bases },
    colors: obj({ primary: str, accent: str, surface: str }),
    font: { type: "string", enum: THEME_FONTS.map((f) => f.id) },
    headingFont: { type: "string", enum: HEADING_IDS },
    buttonStyle: { type: "string", enum: ["rounded", "square"] },
    announcement: obj({ enabled: { type: "boolean" }, text: str }),
    hero: obj({ headline: str, subtext: str, ctaText: str }),
    about: obj({ title: str, text: str }),
    description: str,
  });
  return obj({ proposals: { type: "array", items: proposal } });
}

const rawV2Proposal = z.object({
  name: z.string(),
  rationale: z.string(),
  base: z.string(),
  colors: z.object({ primary: z.string(), accent: z.string(), surface: z.string() }),
  font: z.string(),
  headingFont: z.string(),
  buttonStyle: z.string(),
  announcement: z.object({ enabled: z.boolean(), text: z.string() }),
  hero: z.object({ headline: z.string(), subtext: z.string(), ctaText: z.string() }),
  about: z.object({ title: z.string(), text: z.string() }),
  description: z.string(),
});
const rawV2Output = z.object({ proposals: z.array(rawV2Proposal) });

function outputSchema(layouts: LayoutId[]) {
  const str = { type: "string" };
  const obj = (properties: Record<string, unknown>) => ({
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  });
  const proposal = obj({
    name: str,
    rationale: str,
    layout: { type: "string", enum: layouts },
    colors: obj({ primary: str, accent: str, surface: str }),
    font: { type: "string", enum: THEME_FONTS.map((f) => f.id) },
    buttonStyle: { type: "string", enum: ["rounded", "square"] },
    cardStyle: { type: "string", enum: ["soft", "bordered"] },
    announcement: obj({ enabled: { type: "boolean" }, text: str }),
    hero: obj({ headline: str, subtext: str, ctaText: str }),
    about: obj({ title: str, text: str }),
    description: str,
    sectionTitles: {
      type: "array",
      items: obj({ id: str, title: str, subtitle: str }),
    },
  });
  return obj({ proposals: { type: "array", items: proposal } });
}

/** Lo que vuelve del modelo, antes de limpiarlo. */
const rawProposal = z.object({
  name: z.string(),
  rationale: z.string(),
  layout: z.string(),
  colors: z.object({ primary: z.string(), accent: z.string(), surface: z.string() }),
  font: z.string(),
  buttonStyle: z.string(),
  cardStyle: z.string(),
  announcement: z.object({ enabled: z.boolean(), text: z.string() }),
  hero: z.object({ headline: z.string(), subtext: z.string(), ctaText: z.string() }),
  about: z.object({ title: z.string(), text: z.string() }),
  description: z.string(),
  sectionTitles: z.array(z.object({ id: z.string(), title: z.string(), subtitle: z.string() })),
});
const rawOutput = z.object({ proposals: z.array(rawProposal) });
type RawProposal = z.infer<typeof rawProposal>;

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Recorta al largo que acepta el editor (mismos topes que updateStoreTheme). */
function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Convierte una propuesta del modelo en un diseño completo encima del actual.
 *
 * Se conserva lo que el comerciante ya subió o escribió y la IA no toca:
 * imágenes del diseño, testimonios, locales, video. Cualquier valor que no
 * pase (un color mal escrito, una plantilla que no le toca) cae al de la
 * plantilla, en vez de tumbar la propuesta entera.
 */
function toProposal(
  raw: RawProposal,
  current: StoreTheme,
  allowed: LayoutId[],
): DesignProposal | null {
  const layout = raw.layout as LayoutId;
  if (!allowed.includes(layout)) return null;
  const preset = THEME_PRESETS.find((p) => p.id === layout)!.theme;

  const color = (v: string, fallback: string) => (HEX.test(v.trim()) ? v.trim() : fallback);
  const font = THEME_FONTS.some((f) => f.id === raw.font)
    ? (raw.font as ThemeFont)
    : preset.font;

  const seeded = seedBlocks(layout, { blocks: current.blocks, blockOrder: current.blockOrder });
  for (const def of LAYOUT_BLOCKS[layout] ?? []) {
    const t = raw.sectionTitles.find((s) => s.id === def.id);
    if (!t) continue;
    seeded.blocks[def.id] = {
      ...seeded.blocks[def.id]!,
      title: def.fields.includes("title") ? clip(t.title, 80) : "",
      subtitle: def.fields.includes("subtitle") ? clip(t.subtitle, 200) : "",
    };
  }

  const about = { title: clip(raw.about.title, 80), text: clip(raw.about.text, 2000) };
  // En la clásica el "Sobre nosotros" es una sección aparte: si hay texto, que
  // se vea (la plantilla igual la esconde cuando está vacía).
  const sections: SectionId[] =
    about.text && !current.sections.includes("about")
      ? [...current.sections, "about"]
      : current.sections;

  const announcementText = clip(raw.announcement.text, 140);
  const colors = {
    primary: color(raw.colors.primary, preset.colors.primary),
    accent: color(raw.colors.accent, preset.colors.accent),
    surface: color(raw.colors.surface, preset.colors.surface),
  };
  return {
    name: clip(raw.name, 40),
    rationale: clip(raw.rationale, 240),
    description: clip(raw.description, 300),
    design: layout,
    colors,
    theme: {
      ...current,
      preset: "ai",
      layout,
      colors,
      font,
      buttonStyle: (["rounded", "square"].includes(raw.buttonStyle)
        ? raw.buttonStyle
        : preset.buttonStyle) as ButtonStyle,
      cardStyle: (["soft", "bordered"].includes(raw.cardStyle)
        ? raw.cardStyle
        : preset.cardStyle) as CardStyle,
      announcement: {
        enabled: raw.announcement.enabled && announcementText.length > 0,
        text: announcementText,
      },
      hero: {
        headline: clip(raw.hero.headline, 140),
        subtext: clip(raw.hero.subtext, 240),
        ctaText: clip(raw.hero.ctaText, 40),
      },
      about,
      sections,
      blocks: seeded.blocks,
      blockOrder: seeded.blockOrder,
    },
  };
}

/**
 * Editor por secciones: la propuesta es un cambio (diseño base + colores +
 * fuentes + textos) que se ve en la vista previa real y se aplica al borrador.
 */
function toV2Proposal(raw: z.infer<typeof rawV2Proposal>, allowed: string[]): DesignProposal | null {
  const base = getBase(raw.base);
  if (!base || !allowed.includes(base.id)) return null;
  const palette = base.palettes.general;
  const color = (v: string, fallback: string) => (HEX.test(v.trim()) ? v.trim() : fallback);
  const colors = {
    primary: color(raw.colors.primary, palette.primary),
    accent: color(raw.colors.accent, palette.accent),
    surface: color(raw.colors.surface, palette.surface),
  };
  const font = THEME_FONTS.some((f) => f.id === raw.font) ? (raw.font as ThemeFont) : base.tokens.font;
  const headingFont = HEADING_IDS.includes(raw.headingFont as Exclude<HeadingFont, "auto">)
    ? (raw.headingFont as HeadingFont)
    : base.tokens.headingFont;
  const announcement = clip(raw.announcement.text, 140);

  return {
    name: clip(raw.name, 40),
    rationale: clip(raw.rationale, 240),
    description: clip(raw.description, 300),
    design: base.id,
    colors,
    patch: {
      base: base.id,
      tokens: {
        colors,
        font,
        headingFont,
        buttonStyle: raw.buttonStyle === "square" ? "square" : "rounded",
      },
      texts: {
        headline: clip(raw.hero.headline, 140),
        subtext: clip(raw.hero.subtext, 240),
        ctaText: clip(raw.hero.ctaText, 40),
        aboutTitle: clip(raw.about.title, 80),
        aboutText: clip(raw.about.text, 2000),
        announcement: raw.announcement.enabled ? announcement : "",
      },
    },
  };
}

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/**
 * Baja la imagen y la manda en base64. No se le pasa la URL al modelo: si
 * Anthropic no pudiera bajarla, falla la llamada entera. Así, una foto rota o
 * un logo en SVG solo se saltan.
 */
async function fetchImage(url: string): Promise<Anthropic.Beta.BetaImageBlockParam | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() as ImageType;
    if (!IMAGE_TYPES.includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 4_000_000) return null;
    return { type: "image", source: { type: "base64", media_type: type, data: buf.toString("base64") } };
  } catch {
    return null;
  }
}

function storeFacts(ctx: DesignContext): string {
  const lines = [`Nombre de la tienda: ${ctx.storeName}`];
  if (ctx.description) lines.push(`Descripción actual: ${ctx.description}`);
  if (ctx.address) lines.push(`Ubicación: ${ctx.address}`);
  if (ctx.instagram) lines.push(`Instagram: ${ctx.instagram}`);
  const delivery = ctx.offersDelivery
    ? `Hace delivery${ctx.deliveryNote ? ` (${ctx.deliveryNote})` : ""}${
        ctx.freeDeliveryMin ? `, gratis desde US$${ctx.freeDeliveryMin}` : ""
      }`
    : "No hace delivery";
  lines.push(delivery);
  lines.push(ctx.offersPickup ? "Se puede retirar en tienda" : "No tiene retiro en tienda");
  lines.push(ctx.showBsPrices ? "Muestra precios en USD y en Bs" : "Muestra precios en USD");
  if (ctx.paymentMethods.length) lines.push(`Formas de pago: ${ctx.paymentMethods.join(", ")}`);
  if (ctx.categories.length) lines.push(`Categorías: ${ctx.categories.join(", ")}`);
  if (ctx.products.length) lines.push(`Algunos productos: ${ctx.products.join(", ")}`);
  return lines.join("\n");
}

export interface GenerateOptions {
  /** "v2": tiendas con el editor por secciones (propuestas sobre los diseños base). */
  mode: "legacy" | "v2";
  /** Lo que ya vio en intentos anteriores, para no repetirlo. */
  seen: SeenProposal[];
}

/**
 * Pide las tres propuestas. Anota la generación (bien o mal) para el tope
 * diario y para saber cuánto se gasta.
 */
export async function generateDesignProposals(
  storeId: string,
  ctx: DesignContext,
  current: StoreTheme,
  opts: GenerateOptions = { mode: "legacy", seen: [] },
): Promise<GenerateDesignResult> {
  const v2 = opts.mode === "v2";
  const allowed = ctx.pro ? LAYOUT_IDS : FREE_LAYOUTS;
  const allowedBases = BASES.filter((b) => ctx.pro || !baseNeedsPro(b)).map((b) => b.id);
  const directions = pickDirections(opts.seen);

  const images = (
    await Promise.all(ctx.images.map(async (img) => ({ ...img, block: await fetchImage(img.url) })))
  ).filter((i): i is typeof i & { block: Anthropic.Beta.BetaImageBlockParam } => i.block !== null);
  const hasLogo = images.some((i) => i.kind === "logo");
  const productPhotos = images.filter((i) => i.kind === "product").length;

  const imageNote = [
    hasLogo ? "La primera imagen es el logo." : null,
    productPhotos ? `${hasLogo ? "Las siguientes son" : "Las imágenes son"} fotos de sus productos.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const available = v2
    ? `Diseños base disponibles para esta tienda: ${allowedBases.join(", ")}.`
    : `Plantillas disponibles para esta tienda: ${allowed.join(", ")}.`;
  const text = `${available}

Datos de la tienda:
${storeFacts(ctx)}
${imageNote ? `\n${imageNote}\n` : ""}
Lo que el comerciante cuenta de su negocio:
"""
${ctx.brief}
"""

${varietyNote(directions, opts.seen)}`;

  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const client = new Anthropic();
    // Un solo intento con techo de 100 s: la página corre con maxDuration de
    // 120 s, y un reintento automático la pasaría de largo sin avisar.
    const stream = client.beta.messages.stream(
      {
        model: AI_DESIGN_MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Esfuerzo bajo: lo que importa acá es el gusto, no razonar mucho, y el
        // comerciante está esperando frente a la pantalla. Se ajusta midiendo.
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: v2 ? v2OutputSchema(allowedBases) : outputSchema(allowed) },
        },
        system: v2 ? V2_SYSTEM_PROMPT : SYSTEM_PROMPT,
        messages: [
          { role: "user", content: [...images.map((i) => i.block), { type: "text", text }] },
        ],
      },
      { timeout: 100_000, maxRetries: 0 },
    );
    const message = await stream.finalMessage();
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;

    if (message.stop_reason === "refusal") {
      await recordGeneration({ storeId, ok: false, inputTokens, outputTokens });
      return {
        ok: false,
        error: "No pudimos diseñar con esa descripción. Cuéntalo de otra forma e intenta de nuevo.",
      };
    }
    const block = message.content.find((b) => b.type === "text");
    const json = message.stop_reason === "end_turn" && block?.type === "text" ? JSON.parse(block.text) : null;
    let proposals: DesignProposal[] = [];
    if (v2) {
      const parsed = rawV2Output.safeParse(json);
      if (parsed.success) {
        proposals = parsed.data.proposals
          .map((p) => toV2Proposal(p, allowedBases))
          .filter((p): p is DesignProposal => p !== null);
      }
    } else {
      const parsed = rawOutput.safeParse(json);
      if (parsed.success) {
        proposals = parsed.data.proposals
          .map((p) => toProposal(p, current, allowed))
          .filter((p): p is DesignProposal => p !== null);
      }
    }
    // Cada propuesta lleva su dirección (la 1 es "la que mejor le queda").
    proposals = proposals.slice(0, 3).map((p, i) => ({ ...p, direction: i === 0 ? "ajuste" : directions[i - 1]?.id }));

    if (!proposals.length) {
      reportError("generateDesignProposals", new Error("Respuesta sin propuestas válidas"), {
        storeId,
        stopReason: message.stop_reason,
      });
      await recordGeneration({ storeId, ok: false, inputTokens, outputTokens });
      return { ok: false, error: "No salió bien esta vez. Intenta de nuevo." };
    }

    await recordGeneration({ storeId, ok: true, inputTokens, outputTokens });
    return { ok: true, proposals };
  } catch (err) {
    reportError("generateDesignProposals", err, { storeId });
    await recordGeneration({ storeId, ok: false, inputTokens, outputTokens });
    const busy =
      err instanceof Anthropic.RateLimitError ||
      (err instanceof Anthropic.APIError && (err.status ?? 0) >= 500);
    return {
      ok: false,
      error: busy
        ? "El diseñador está muy ocupado ahora mismo. Intenta en un par de minutos."
        : "No pudimos generar el diseño. Intenta de nuevo.",
    };
  }
}
