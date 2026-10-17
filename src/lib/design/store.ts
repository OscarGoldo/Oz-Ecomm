import "server-only";

import { parseDesign, savedDesign, type DesignStore } from "@/lib/design/design";
import type { StoreDesign } from "@/lib/design/types";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

/**
 * Borrador, publicado e historial del diseño v2 (migración 0033).
 *
 * Todo con service role: quien llama ya verificó que la tienda es de la
 * sesión, y el `store_id` sale siempre de esa sesión, nunca del cliente.
 */

/** Cuántas publicaciones se guardan para volver atrás. */
export const DESIGN_VERSIONS_KEPT = 20;

/** ¿Corrió la migración 0033? Sin ella, el editor nuevo no se muestra. */
export async function designTablesReady(): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("store_design_drafts")
    .select("store_id", { head: true, count: "exact" })
    .limit(1);
  return !error;
}

/**
 * El diseño con el que abre el editor: el borrador si hay uno, si no lo
 * publicado (o lo de siempre, traducido).
 */
export async function loadDraft(
  store: DesignStore & { id: string },
): Promise<{ design: StoreDesign; dirty: boolean }> {
  const { data } = await createAdminClient()
    .from("store_design_drafts")
    .select("design")
    .eq("store_id", store.id)
    .maybeSingle();
  const draft = parseDesign(data?.design);
  return draft ? { design: draft, dirty: true } : { design: savedDesign(store), dirty: false };
}

export async function saveDraft(storeId: string, design: StoreDesign): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("store_design_drafts")
    .upsert({ store_id: storeId, design: design as unknown as Json, updated_at: new Date().toISOString() });
  if (error) reportError("saveDraft", new Error(error.message), { storeId });
  return !error;
}

export async function discardDraft(storeId: string): Promise<boolean> {
  const { error } = await createAdminClient().from("store_design_drafts").delete().eq("store_id", storeId);
  return !error;
}

/**
 * Publica: el diseño pasa a `stores.design`, queda una versión en el
 * historial y se borra el borrador. Las versiones viejas pasadas de
 * DESIGN_VERSIONS_KEPT se limpian.
 */
export async function publishDesign(
  storeId: string,
  design: StoreDesign,
  userId: string | null,
): Promise<boolean> {
  const db = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("stores")
    .update({ design: design as unknown as Json, design_published_at: now })
    .eq("id", storeId);
  if (error) {
    reportError("publishDesign", new Error(error.message), { storeId });
    return false;
  }

  await db.from("store_design_versions").insert({
    store_id: storeId,
    design: design as unknown as Json,
    published_by: userId,
  });
  await db.from("store_design_drafts").delete().eq("store_id", storeId);

  // Limpieza: deja las últimas N.
  const { data: old } = await db
    .from("store_design_versions")
    .select("id")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .range(DESIGN_VERSIONS_KEPT, DESIGN_VERSIONS_KEPT + 50);
  if (old?.length) {
    await db.from("store_design_versions").delete().in("id", old.map((v) => v.id));
  }
  return true;
}

export interface DesignVersion {
  id: string;
  created_at: string;
}

export async function listVersions(storeId: string): Promise<DesignVersion[]> {
  const { data } = await createAdminClient()
    .from("store_design_versions")
    .select("id, created_at")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(DESIGN_VERSIONS_KEPT);
  return data ?? [];
}

export async function loadVersion(storeId: string, versionId: string): Promise<StoreDesign | null> {
  const { data } = await createAdminClient()
    .from("store_design_versions")
    .select("design")
    .eq("store_id", storeId)
    .eq("id", versionId)
    .maybeSingle();
  return parseDesign(data?.design);
}
