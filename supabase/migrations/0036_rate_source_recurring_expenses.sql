-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0036  La tasa que elige el comerciante y los gastos que se repiten
--
--   1. TASA. Hasta acá la única tasa que se actualizaba sola era el dólar BCV
--      (`auto_exchange_rate`). Ahora el comerciante elige de dónde sale:
--      dólar BCV, euro BCV o USDT (Binance P2P), y le puede sumar o restar un
--      porcentaje ("USDT − 2 %", "dólar BCV + 10 %"). El cron de cada hora
--      (/api/cron/bcv) calcula base × (1 + ajuste / 100) y lo escribe en
--      `exchange_rate`, que sigue siendo la única tasa que leen la tienda, el
--      checkout y Finanzas. `auto_exchange_rate` sigue diciendo si es
--      automática o fija; con la fija, estas dos columnas no se usan.
--
--      Correr esto no le cambia la tasa a nadie: todas quedan en dólar BCV
--      + 0 %, salvo las que tenían `currency_primary = 'EUR'`, a las que el
--      cron ya les ponía el euro.
--
--   2. GASTOS QUE SE REPITEN. El alquiler, los servicios: se cargan una vez con
--      su frecuencia y el cron diario (/api/cron/gastos) registra cada pago en
--      `expenses` el día que toca. Así los totales, los reportes y la ganancia
--      neta los cuentan sin tocar finance_summary ni finance_range.
--
--   El código funciona sin esta migración (todas las tiendas en dólar BCV y
--   sin gastos que se repiten), pero guardar Ajustes y crear un gasto que se
--   repite fallan hasta correrla. Correrla ANTES del deploy.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1. De dónde sale la tasa ────────────────────────────────────────────────

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS exchange_rate_source TEXT NOT NULL DEFAULT 'bcv_usd',
  ADD COLUMN IF NOT EXISTS exchange_rate_margin NUMERIC(6,2) NOT NULL DEFAULT 0;

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_exchange_rate_source_check;
ALTER TABLE stores ADD CONSTRAINT stores_exchange_rate_source_check
  CHECK (exchange_rate_source IN ('bcv_usd', 'bcv_eur', 'usdt'));

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_exchange_rate_margin_check;
ALTER TABLE stores ADD CONSTRAINT stores_exchange_rate_margin_check
  CHECK (exchange_rate_margin BETWEEN -50 AND 100);

-- Las que cobraban en euros ya recibían el euro del BCV: siguen igual.
UPDATE stores
SET exchange_rate_source = 'bcv_eur'
WHERE currency_primary = 'EUR' AND exchange_rate_source = 'bcv_usd';

-- updateStoreSettings() escribe estas dos con el rol del comerciante (ver
-- 0021): sin el GRANT, guardar Ajustes falla con 42501.
GRANT UPDATE (exchange_rate_source, exchange_rate_margin) ON stores TO authenticated;


-- ── 2. Gastos que se repiten ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT,
  -- En dólares, como `expenses`.
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'yearly')),
  -- El primer pago. De acá salen el día del mes (o de la semana) de los demás.
  starts_on DATE NOT NULL,
  -- El próximo pago que falta registrar. El cron lo registra y lo mueve.
  next_due_on DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_expenses_store
  ON recurring_expenses(store_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_due
  ON recurring_expenses(next_due_on) WHERE active;

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages own recurring expenses" ON recurring_expenses;
CREATE POLICY "Owner manages own recurring expenses" ON recurring_expenses
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages recurring expenses" ON recurring_expenses;
CREATE POLICY "Super admin manages recurring expenses" ON recurring_expenses
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Cada pago registrado sabe de qué gasto que se repite salió. Si se borra el
-- que se repite, los pagos ya registrados quedan como gastos normales.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS recurring_expense_id UUID
    REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- Un pago por fecha: si el cron corre dos veces, el segundo no duplica. Sin
-- WHERE a propósito: el cron inserta con ON CONFLICT sobre estas dos columnas
-- y Postgres no acepta un índice parcial ahí. Los gastos sueltos no chocan
-- entre sí porque su recurring_expense_id es NULL, y dos NULL nunca son iguales.
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurring_day
  ON expenses(recurring_expense_id, spent_at);
