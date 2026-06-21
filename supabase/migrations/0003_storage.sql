-- ════════════════════════════════════════════════════════════════════════════
-- Oz Ecom — 0003 Storage buckets & policies
--   store-images   : PUBLIC read. Logos, banners, product photos.
--   payment-proofs : PRIVATE. Only the owning store reads its proofs.
-- Object paths are organized by store_id:  <store_id>/<...>
-- ════════════════════════════════════════════════════════════════════════════

-- ── Buckets ──────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-images', 'store-images', TRUE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', FALSE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ── store-images: public read, owner writes within its own folder ────────────
DROP POLICY IF EXISTS "store-images public read" ON storage.objects;
CREATE POLICY "store-images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-images');

DROP POLICY IF EXISTS "store-images owner write" ON storage.objects;
CREATE POLICY "store-images owner write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'store-images'
    AND (storage.foldername(name))[1] = current_store_id()::text
  );

DROP POLICY IF EXISTS "store-images owner update" ON storage.objects;
CREATE POLICY "store-images owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND (storage.foldername(name))[1] = current_store_id()::text
  );

DROP POLICY IF EXISTS "store-images owner delete" ON storage.objects;
CREATE POLICY "store-images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'store-images'
    AND (storage.foldername(name))[1] = current_store_id()::text
  );

-- ── payment-proofs: anyone can upload (guest checkout), only owner reads ──────
DROP POLICY IF EXISTS "payment-proofs upload" ON storage.objects;
CREATE POLICY "payment-proofs upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "payment-proofs owner read" ON storage.objects;
CREATE POLICY "payment-proofs owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = current_store_id()::text
  );
