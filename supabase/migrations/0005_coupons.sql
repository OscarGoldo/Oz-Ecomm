-- ════════════════════════════════════════════════════════════════════════════
-- Oz Ecom — 0005 Coupons (discount codes)
-- Store-scoped discount codes applied at checkout. Promotions (auto 2x1, etc.)
-- are a separate future system.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code TEXT NOT NULL,                         -- stored uppercased
  type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,     -- percent (0-100) or fixed USD
  min_cart NUMERIC(12,2),                     -- min subtotal (USD) to apply
  max_discount NUMERIC(12,2),                 -- cap (USD) for percentage type
  usage_limit INTEGER,                        -- NULL = unlimited total uses
  times_used INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, code)
);
CREATE INDEX IF NOT EXISTS idx_coupons_store ON coupons(store_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS coupon_code TEXT;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- No public read: coupon codes are validated server-side (service role) so they
-- are not enumerable by anonymous visitors.
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own coupons" ON coupons;
CREATE POLICY "Owner manages own coupons" ON coupons
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages coupons" ON coupons;
CREATE POLICY "Super admin manages coupons" ON coupons
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
