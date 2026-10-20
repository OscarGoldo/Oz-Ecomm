"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionContext } from "@/lib/auth";
import { proposeExampleCatalog, type ExampleProposal, type ProposedProduct } from "@/lib/ai-example";
import { BASES, RUBROS, type RubroId } from "@/lib/design/bases";
import { stockPhotoUrl, isStockPhotoId } from "@/lib/example-photos";
import {
  EXAMPLE_UPLOAD_FOLDERS,
  applyDesignPatch,
  createExampleStore,
  deleteExampleStore,
  exampleDesign,
  exampleRubro,
  getExampleStore,
  saveExampleDesign,
  withFaq,
  type ExampleUploadFolder,
} from "@/lib/example-pages";
import { isReservedSlug, slugify, STORE_SLUG_MAX } from "@/lib/slug";
import { STORE_IMAGES_BUCKET } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Las acciones de /super/ejemplos. Todas pasan por requireSuperAdmin() y
 * todas verifican que la tienda sea una página ejemplo antes de tocarla: con
 * service role no hay RLS que lo cuide, así que el candado es `example = true`.
 */

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

async function isSuperAdmin(): Promise<boolean> {
  const ctx = await getSessionContext();
  return ctx?.user.role === "super_admin";
}

function refresh(id?: string) {
  revalidatePath("/super/ejemplos");
  if (id) revalidatePath(`/super/ejemplos/${id}`);
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const rubroSchema = z.enum(RUBROS.map((r) => r.id) as [RubroId, ...RubroId[]]);

// ─── Crear y borrar ────────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(80),
  slug: z.string().trim().max(80).optional(),
  rubro: rubroSchema,
  whatsapp: optText(30),
  instagram: optText(60),
  about: optText(600),
});

export type CreateExampleInput = z.input<typeof createSchema>;

export async function createExample(input: CreateExampleInput): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const slug = slugify(d.slug || d.name);
  if (!slug) return { ok: false, error: "No se pudo armar el enlace con ese nombre" };
  if (isReservedSlug(slug)) return { ok: false, error: `El enlace "${slug}" está reservado, elige otro` };
  if (slug.length > STORE_SLUG_MAX) {
    return { ok: false, error: `El enlace puede tener hasta ${STORE_SLUG_MAX} caracteres` };
  }
  const { data: taken } = await createAdminClient().from("stores").select("id").eq("slug", slug).maybeSingle();
  if (taken) return { ok: false, error: `El enlace "${slug}" ya está en uso. Cámbialo abajo.` };

  const res = await createExampleStore({
    name: d.name,
    slug,
    rubro: d.rubro,
    whatsapp: d.whatsapp,
    instagram: d.instagram?.replace(/^@/, "") ?? null,
    description: d.about,
  });
  if (!res.ok) return res;
  refresh();
  return { ok: true, id: res.id };
}

export async function deleteExample(id: string): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const ok = await deleteExampleStore(id);
  if (!ok) return { ok: false, error: "No se pudo borrar la página" };
  refresh();
  return { ok: true };
}

// ─── Datos de la tienda ────────────────────────────────────────────────────

/** Una foto subida a la carpeta de ESTA página, o una de stock. Nada más. */
function ownImage(storeId: string, value: string | null | undefined): string | null | false {
  if (!value) return null;
  if (value.startsWith(`${storeId}/`) && !value.includes("..")) return value;
  if (value.startsWith("https://images.unsplash.com/photo-")) return value;
  return false;
}

const infoSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(80),
  description: optText(600),
  whatsapp: optText(30),
  instagram: optText(60),
  address: optText(160),
  logo_url: z.string().trim().max(400).nullable().optional(),
  banner_url: z.string().trim().max(400).nullable().optional(),
});

export type ExampleInfoInput = z.input<typeof infoSchema>;

export async function updateExampleInfo(id: string, input: ExampleInfoInput): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  const parsed = infoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const logo = ownImage(store.id, d.logo_url);
  const banner = ownImage(store.id, d.banner_url);
  if (logo === false || banner === false) return { ok: false, error: "Esa foto no es válida. Súbela de nuevo." };

  const { error } = await createAdminClient()
    .from("stores")
    .update({
      name: d.name,
      description: d.description,
      whatsapp: d.whatsapp,
      instagram: d.instagram?.replace(/^@/, "") ?? null,
      address: d.address,
      pickup_address: d.address,
      logo_url: logo,
      banner_url: banner,
    })
    .eq("id", store.id)
    .eq("example", true);
  if (error) return { ok: false, error: "No se pudo guardar" };
  refresh(store.id);
  return { ok: true };
}

// ─── Diseño ────────────────────────────────────────────────────────────────

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido");

const designSchema = z.object({
  base: z.string().refine((b) => BASES.some((x) => x.id === b), "Diseño inválido"),
  colors: z.object({ primary: hex, accent: hex, surface: hex }),
  headline: z.string().max(140),
  subtext: z.string().max(240),
  ctaText: z.string().max(40),
  announcement: z.string().max(140),
  aboutTitle: z.string().max(80),
  aboutText: z.string().max(2000),
});

export type ExampleDesignInput = z.input<typeof designSchema>;

export async function updateExampleDesign(id: string, input: ExampleDesignInput): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  let design = exampleDesign(store, "general");
  // Cambiar de diseño base reacomoda las secciones pero conserva los textos,
  // fotos y preguntas que ya tenía (ver carryContent en lib/design/bases.ts).
  if (design.tokens.base !== d.base) {
    design = applyDesignPatch(design, { base: d.base, rubro: exampleRubro(design) });
  }
  design = applyDesignPatch(design, {
    tokens: { colors: d.colors },
    texts: {
      headline: d.headline.trim(),
      subtext: d.subtext.trim(),
      ctaText: d.ctaText.trim(),
      announcement: d.announcement.trim(),
      ...(d.aboutText.trim() && { aboutTitle: d.aboutTitle.trim(), aboutText: d.aboutText.trim() }),
    },
  });

  if (!(await saveExampleDesign(store.id, design))) return { ok: false, error: "No se pudo guardar el diseño" };
  refresh(store.id);
  return { ok: true };
}

// ─── Productos ─────────────────────────────────────────────────────────────

/** La categoría con ese nombre, o una nueva. Devuelve su id. */
async function categoryId(storeId: string, name: string | null): Promise<string | null> {
  const clean = name?.trim();
  if (!clean) return null;
  const db = createAdminClient();
  const slug = slugify(clean) || "categoria";
  const { data: found } = await db
    .from("categories")
    .select("id")
    .eq("store_id", storeId)
    .eq("slug", slug)
    .maybeSingle();
  if (found) return found.id;

  const { count } = await db
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  const { data: created } = await db
    .from("categories")
    .insert({ store_id: storeId, name: clean, slug, display_order: count ?? 0 })
    .select("id")
    .single();
  return created?.id ?? null;
}

const productSchema = z.object({
  name: z.string().trim().min(2, "El nombre es muy corto").max(120),
  description: optText(2000),
  price: z.coerce.number().min(0, "Precio inválido").max(1_000_000),
  compareAtPrice: z.coerce.number().min(0).max(1_000_000).nullable().optional(),
  category: optText(40),
  image: z.string().trim().max(400).nullable().optional(),
  featured: z.boolean().default(false),
});

export type ExampleProductInput = z.input<typeof productSchema>;

interface ProductRow {
  name: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  categoryId: string | null;
  image: string | null;
  featured: boolean;
}

async function insertProduct(storeId: string, p: ProductRow): Promise<boolean> {
  const db = createAdminClient();
  const baseSlug = slugify(p.name) || "producto";
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomUUID().slice(0, 4)}`;
    const { error } = await db.from("products").insert({
      store_id: storeId,
      category_id: p.categoryId,
      name: p.name,
      slug,
      description: p.description,
      price: p.price,
      compare_at_price: p.compareAtPrice,
      images: p.image ? [p.image] : [],
      featured: p.featured,
      status: "active",
      // Sin control de stock: en una página ejemplo nada se agota.
      stock: 0,
      track_stock: false,
    });
    if (!error) return true;
    if (error.code !== "23505") return false;
  }
  return false;
}

export async function saveExampleProduct(
  id: string,
  productId: string | null,
  input: ExampleProductInput,
): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const image = ownImage(store.id, d.image);
  if (image === false) return { ok: false, error: "Esa foto no es válida. Súbela de nuevo." };
  const compareAt = d.compareAtPrice && d.compareAtPrice > d.price ? d.compareAtPrice : null;
  const catId = await categoryId(store.id, d.category);

  const db = createAdminClient();
  if (productId) {
    const { error } = await db
      .from("products")
      .update({
        name: d.name,
        description: d.description,
        price: d.price,
        compare_at_price: compareAt,
        category_id: catId,
        images: image ? [image] : [],
        featured: d.featured,
      })
      .eq("id", productId)
      .eq("store_id", store.id);
    if (error) return { ok: false, error: "No se pudo guardar el producto" };
  } else {
    const ok = await insertProduct(store.id, {
      name: d.name,
      description: d.description,
      price: d.price,
      compareAtPrice: compareAt,
      categoryId: catId,
      image,
      featured: d.featured,
    });
    if (!ok) return { ok: false, error: "No se pudo crear el producto" };
  }
  refresh(store.id);
  return { ok: true };
}

export async function deleteExampleProduct(id: string, productId: string): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  const { error } = await createAdminClient()
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("store_id", store.id);
  if (error) return { ok: false, error: "No se pudo borrar el producto" };
  refresh(store.id);
  return { ok: true };
}

// ─── Fotos ─────────────────────────────────────────────────────────────────

const UPLOAD_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export interface UploadTicket {
  ok: boolean;
  path?: string;
  token?: string;
  error?: string;
}

/**
 * Permiso de un solo uso para subir una foto a la carpeta de la página. El
 * super admin no es dueño de esa carpeta, así que la subida directa la
 * rechazaría el storage; con la URL firmada la ruta la elige el servidor.
 */
export async function exampleUploadTicket(
  id: string,
  ext: string,
  folder: ExampleUploadFolder,
): Promise<UploadTicket> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  if (!EXAMPLE_UPLOAD_FOLDERS.includes(folder)) return { ok: false, error: "Destino inválido" };
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!UPLOAD_EXT.has(clean)) return { ok: false, error: "Sube una foto JPG, PNG o WEBP" };

  const path = `${store.id}/${folder}/${randomUUID()}.${clean}`;
  const { data, error } = await createAdminClient().storage
    .from(STORE_IMAGES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "No se pudo preparar la subida" };
  return { ok: true, path: data.path, token: data.token };
}

// ─── Atajo con IA ──────────────────────────────────────────────────────────

const proposeSchema = z.object({
  about: z.string().trim().min(8, "Cuéntale a la IA un poco más de qué vende").max(1200),
  city: optText(60),
});

export async function proposeExample(
  id: string,
  input: z.input<typeof proposeSchema>,
): Promise<{ ok: true; proposal: ExampleProposal } | { ok: false; error: string }> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  const parsed = proposeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const { data: existing } = await createAdminClient()
    .from("products")
    .select("name")
    .eq("store_id", store.id)
    .limit(60);

  // Lo que le contaron a la IA queda como descripción de la página si no
  // tenía una: es lo que el negocio vende, dicho por los socios.
  if (!store.description) {
    await createAdminClient()
      .from("stores")
      .update({ description: parsed.data.about.slice(0, 600) })
      .eq("id", store.id)
      .eq("example", true);
  }

  return proposeExampleCatalog(store.id, {
    storeName: store.name,
    about: parsed.data.about,
    city: parsed.data.city,
    rubro: exampleRubro(exampleDesign(store, "general")),
    existingProducts: (existing ?? []).map((p) => p.name),
  });
}

const proposedSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().max(2000),
  price: z.number().min(0).max(1_000_000),
  compareAtPrice: z.number().min(0).max(1_000_000).nullable(),
  category: z.string().max(40),
  photo: z.string().nullable(),
  featured: z.boolean(),
});

const applySchema = z.object({
  products: z.array(proposedSchema).max(30),
  texts: z
    .object({
      headline: z.string().max(140),
      subtext: z.string().max(240),
      ctaText: z.string().max(40),
      aboutTitle: z.string().max(80),
      aboutText: z.string().max(2000),
      announcement: z.string().max(140),
    })
    .nullable(),
  faq: z.array(z.object({ q: z.string().max(160), a: z.string().max(800) })).max(10),
});

/** Guarda lo que los socios eligieron de la propuesta de la IA. */
export async function applyProposal(
  id: string,
  input: { products: ProposedProduct[]; texts: ExampleProposal["texts"] | null; faq: ExampleProposal["faq"] },
): Promise<ActionResult> {
  if (!(await isSuperAdmin())) return { ok: false, error: "No autorizado" };
  const store = await getExampleStore(id);
  if (!store) return { ok: false, error: "No existe esa página" };
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "La propuesta no es válida. Pídela de nuevo." };
  const { products, texts, faq } = parsed.data;

  const catIds = new Map<string, string | null>();
  let failed = 0;
  for (const p of products) {
    const key = p.category.trim().toLowerCase();
    if (!catIds.has(key)) catIds.set(key, await categoryId(store.id, p.category));
    const ok = await insertProduct(store.id, {
      name: p.name,
      description: p.description || null,
      price: p.price,
      compareAtPrice: p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null,
      categoryId: catIds.get(key) ?? null,
      image: p.photo && isStockPhotoId(p.photo) ? stockPhotoUrl(p.photo) : null,
      featured: p.featured,
    });
    if (!ok) failed += 1;
  }

  if (texts || faq.length) {
    let design = exampleDesign(store, "general");
    if (texts) design = applyDesignPatch(design, { texts });
    design = withFaq(design, faq);
    await saveExampleDesign(store.id, design);
  }

  refresh(store.id);
  if (failed) return { ok: false, error: `No se pudieron guardar ${failed} productos` };
  return { ok: true };
}
