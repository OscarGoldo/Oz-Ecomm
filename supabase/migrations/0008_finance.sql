-- ════════════════════════════════════════════════════════════════════════════
-- OzShop — 0008 Finance: product cost, order cost snapshot, expenses
-- Enables margins/profit and expense tracking in the Finanzas panel.
-- ════════════════════════════════════════════════════════════════════════════

-- Cost price per product (USD). NULL/0 = unknown cost.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2);

-- Snapshot of the unit cost at order time (so historical margins stay accurate).
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Operating expenses logged by the owner (USD).
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL,
  spent_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_store ON expenses(store_id, spent_at DESC);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own expenses" ON expenses;
CREATE POLICY "Owner manages own expenses" ON expenses
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages expenses" ON expenses;
CREATE POLICY "Super admin manages expenses" ON expenses
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
