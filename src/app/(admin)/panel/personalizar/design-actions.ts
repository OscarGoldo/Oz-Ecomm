"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth";
import { designSchema, parseDesign, proFeaturesUsed, savedDesign } from "@/lib/design/design";
import { designV2Enabled } from "@/lib/design/flag";
import {
  discardDraft,
  listVersions,
  loadVersion,
  publishDesign,
  saveDraft,
  type DesignVersion,
} from "@/lib/design/store";
import type { StoreDesign } from "@/lib/design/types";
import { isPro } from "@/lib/plans";
import type { Json } from "@/types/database";

export type DesignActionResult =
  | { ok: true; design?: StoreDesign }
  | { ok: false; error: string };

/** La tienda de la sesión, si tiene el editor nuevo. */
async function editorStore() {
  const ctx = await getSessionContext();
  const store = ctx?.store;
  if (!store || !designV2Enabled(store)) return null;
  return { store, userId: ctx.user.id };
}

/**
 * Valida y normaliza lo que manda el editor. Se pasa por `parseDesign` además
 * de zod: completa ajustes que falten y descarta lo que no reconoce.
 */
function validDesign(input: unknown): StoreDesign | { error: string } {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Diseño inválido" };
  const design = parseDesign(parsed.data as unknown as Json);
  return design ?? { error: "Diseño inválido" };
}

/** Autoguardado del editor. El borrador puede tener cosas Pro: se prueban antes de pagar. */
export async function saveDesignDraft(input: unknown): Promise<DesignActionResult> {
  const session = await editorStore();
  if (!session) return { ok: false, error: "No autorizado" };
  const design = validDesign(input);
  if ("error" in design) return { ok: false, error: design.error };
  const saved = await saveDraft(session.store.id, design);
  return saved ? { ok: true } : { ok: false, error: "No se pudo guardar el borrador" };
}

export async function publishStoreDesign(input: unknown): Promise<DesignActionResult> {
  const session = await editorStore();
  if (!session) return { ok: false, error: "No autorizado" };
  const design = validDesign(input);
  if ("error" in design) return { ok: false, error: design.error };

  // El candado de verdad vive acá: el editor deja probar todo, publicar no.
  if (!isPro(session.store)) {
    const used = proFeaturesUsed(design);
    if (used.length) {
      return {
        ok: false,
        error: `Para publicar ${used.join(", ")} necesitas el plan Pro. Quítalo u ocúltalo, o activa Pro.`,
      };
    }
  }

  const ok = await publishDesign(session.store.id, design, session.userId);
  if (!ok) return { ok: false, error: "No se pudo publicar. Intenta de nuevo." };
  revalidatePath(`/${session.store.slug}`, "layout");
  return { ok: true };
}

/** Tira el borrador y devuelve lo publicado, para que el editor vuelva a eso. */
export async function discardDesignDraft(): Promise<DesignActionResult> {
  const session = await editorStore();
  if (!session) return { ok: false, error: "No autorizado" };
  await discardDraft(session.store.id);
  return { ok: true, design: savedDesign(session.store) };
}

export async function listDesignVersions(): Promise<DesignVersion[]> {
  const session = await editorStore();
  if (!session) return [];
  return listVersions(session.store.id);
}

/** Trae una publicación vieja como borrador: se revisa y se publica de nuevo. */
export async function restoreDesignVersion(versionId: string): Promise<DesignActionResult> {
  const session = await editorStore();
  if (!session) return { ok: false, error: "No autorizado" };
  const design = await loadVersion(session.store.id, versionId);
  if (!design) return { ok: false, error: "No se encontró esa versión" };
  const saved = await saveDraft(session.store.id, design);
  return saved ? { ok: true, design } : { ok: false, error: "No se pudo restaurar" };
}
