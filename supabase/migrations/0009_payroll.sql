-- ════════════════════════════════════════════════════════════════════════════
-- OzShop — 0009 Payroll (nómina)
-- Optional roster of employees + their salary (USD or VES) and pay frequency.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'VES')),
  frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_store ON employees(store_id);

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own employees" ON employees;
CREATE POLICY "Owner manages own employees" ON employees
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages employees" ON employees;
CREATE POLICY "Super admin manages employees" ON employees
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
