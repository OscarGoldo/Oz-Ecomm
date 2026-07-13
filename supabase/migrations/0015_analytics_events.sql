-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0015  Storefront analytics events
--   Lightweight event log powering the tenant analytics panel: most-viewed
--   products, conversion rate, and the cart→checkout→purchase funnel.
--   (Sales-by-day/hour are derived from `orders`, not this table.)
--
--   Events are written by trusted server actions using the service-role client
--   (which bypasses RLS). Owners read only their own store's events via RLS.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS store_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- Anonymous per-browser id (httpOnly cookie `oz_sid`). Ties a visitor's
  -- events together so we can measure distinct-session funnels/conversion.
  session_id TEXT NOT NULL,
  -- 'product_view' | 'add_to_cart' | 'checkout_start' | 'purchase'
  event_type TEXT NOT NULL,
  -- Present for product_view / add_to_cart; NULL for checkout_start / purchase.
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Range scans per store (dashboard filters by a rolling window).
CREATE INDEX IF NOT EXISTS idx_store_events_store_time
  ON store_events(store_id, created_at DESC);
-- Most-viewed aggregation.
CREATE INDEX IF NOT EXISTS idx_store_events_product
  ON store_events(store_id, product_id)
  WHERE product_id IS NOT NULL;

ALTER TABLE store_events ENABLE ROW LEVEL SECURITY;

-- Owner/staff of the store can read their own events (uses the same helper the
-- rest of the schema relies on). Writes go through the service role only, so no
-- INSERT policy is granted to anon/authenticated.
DROP POLICY IF EXISTS "Owner reads own store events" ON store_events;
CREATE POLICY "Owner reads own store events" ON store_events
  FOR SELECT USING (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin reads store events" ON store_events;
CREATE POLICY "Super admin reads store events" ON store_events
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
