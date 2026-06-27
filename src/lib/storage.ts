export const STORE_IMAGES_BUCKET = "store-images";
export const PAYMENT_PROOFS_BUCKET = "payment-proofs";

/**
 * Resolve a value from `products.images[]` (or store logo/banner) to a usable
 * URL. Stored values may be either:
 *   - an absolute URL (e.g. placeholder seed images) → returned as-is
 *   - a storage path in the public `store-images` bucket → public URL built
 */
export function getImageUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${STORE_IMAGES_BUCKET}/${pathOrUrl}`;
}

/** Build the storage path for a product image: <storeId>/products/<file>. */
export function productImagePath(storeId: string, fileName: string): string {
  return `${storeId}/products/${fileName}`;
}

/** Build the storage path for a theme/design image: <storeId>/theme/<sub>/<file>. */
export function themeImagePath(
  storeId: string,
  sub: string,
  fileName: string,
): string {
  return `${storeId}/theme/${sub}/${fileName}`;
}

/** File extension (lowercased, no dot) from a filename, defaulting to "jpg". */
export function fileExt(name: string): string {
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return (ext || "jpg").toLowerCase();
}
