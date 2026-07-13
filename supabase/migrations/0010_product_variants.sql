-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0010 Product variants (two-axis, e.g. Talla + Color)
-- products.variant_options describes the axes; product_variants holds each
-- generated combination with its own stock / optional price.
-- ════════════════════════════════════════════════════════════════════════════

-- Axis definitions, e.g. [{"name":"Talla","values":["S","M","L"]},
--                          {"name":"Color","values":["Rojo","Azul"]}]
-- NULL/empty = simple product (uses products.stock / products.price).
ALTER TABLE products ADD COLUMN IF NOT EXISTS variant_options JSONB;

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  option_values TEXT[] NOT NULL DEFAULT '{}',   -- ["M","Rojo"] aligned to variant_options
  name TEXT NOT NULL,                            -- "M / Rojo" (denormalized label)
  price NUMERIC(12,2),                           -- override; NULL → products.price
  cost NUMERIC(12,2),
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_store ON product_variants(store_id);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id UUID
  REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_name TEXT;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Public storefront can read variants of active products.
DROP POLICY IF EXISTS "Public reads variants of active products" ON product_variants;
CREATE POLICY "Public reads variants of active products" ON product_variants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_variants.product_id AND p.status = 'active'
    )
  );

-- Owner manages variants of their own store.
DROP POLICY IF EXISTS "Owner manages own variants" ON product_variants;
CREATE POLICY "Owner manages own variants" ON product_variants
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

-- Super admin full access.
DROP POLICY IF EXISTS "Super admin manages variants" ON product_variants;
CREATE POLICY "Super admin manages variants" ON product_variants
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
