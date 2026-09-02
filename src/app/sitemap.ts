import type { MetadataRoute } from "next";

import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";

/**
 * Se regenera cada hora en vez de quedar congelado en el build.
 *
 * Antes el mapa del sitio era una foto del momento del despliegue: una tienda
 * o un producto creados después no aparecían hasta el siguiente deploy. Y si
 * la base no respondía justo durante el build, esa foto vacía se quedaba
 * publicada indefinidamente. Con revalidación, cualquiera de las dos cosas se
 * corrige sola dentro de la hora.
 */
export const revalidate = 3600;

/** Landing + active store homes + their active products. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://tiendifyapp.com";

  // Las rutas que existen siempre, haya base de datos o no. Se arman primero
  // para poder devolverlas si la consulta falla.
  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/crear-tienda`, changeFrequency: "monthly", priority: 0.9 },
  ];

  /**
   * Todo lo que dependa de la base va adentro del try.
   *
   * El sitemap se genera durante el build, y `createAdminClient()` lanza si
   * falta `SUPABASE_SERVICE_ROLE_KEY`. Sin este catch, un error de prerender
   * acá tumba el build ENTERO: una variable de entorno mal configurada en un
   * entorno de preview, o un rato de Supabase caído, y no se despliega nada.
   * Eso ya pasó y costó una noche de depuración.
   *
   * El mapa del sitio es lo menos crítico que hay: si no se puede completar,
   * se publica con las dos rutas estáticas y el buscador vuelve más tarde.
   * Que un archivo de SEO impida desplegar la aplicación es la prioridad al
   * revés.
   */
  try {
    const db = createAdminClient();

    const { data: stores, error: storesError } = await db
      .from("stores")
      .select("id, slug, updated_at")
      .eq("active", true)
      .limit(500);
    if (storesError) throw storesError;

    const storeById = new Map((stores ?? []).map((s) => [s.id, s.slug]));

    const { data: products, error: productsError } = await db
      .from("products")
      .select("slug, store_id, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (productsError) throw productsError;

    for (const s of stores ?? []) {
      entries.push({
        url: `${base}/${s.slug}`,
        lastModified: new Date(s.updated_at),
        changeFrequency: "daily",
        priority: 0.8,
      });
    }

    for (const p of products ?? []) {
      const storeSlug = storeById.get(p.store_id);
      if (!storeSlug) continue; // inactive store
      entries.push({
        url: `${base}/${storeSlug}/producto/${p.slug}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch (error) {
    // Queda en los logs con su ref para poder buscarlo: un sitemap que se
    // degrada en silencio es una caída de SEO que nadie ve hasta que el
    // tráfico baja.
    reportError("sitemap", error, { entries: entries.length });
  }

  return entries;
}
