import type { MetadataRoute } from "next";

import { createAdminClient } from "@/lib/supabase/admin";

/** Landing + active store homes + their active products. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://tiendifyapp.com";
  const db = createAdminClient();

  const { data: stores } = await db
    .from("stores")
    .select("id, slug, updated_at")
    .eq("active", true)
    .limit(500);
  const storeById = new Map((stores ?? []).map((s) => [s.id, s.slug]));

  const { data: products } = await db
    .from("products")
    .select("slug, store_id, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(2000);

  const entries: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/crear-tienda`, changeFrequency: "monthly", priority: 0.9 },
  ];

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

  return entries;
}
