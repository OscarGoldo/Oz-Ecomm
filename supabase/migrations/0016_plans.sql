-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0016  Planes (freemium) y cobro de suscripción
--
--   stores.plan             'free' | 'pro'
--   stores.plan_expires_at  NULL = no vence (cortesía de por vida)
--   stores.plan_source      'free' | 'paid' (pagó) | 'comp' (regalo)
--
--   El vencimiento se evalúa EN LECTURA (src/lib/plans.ts::isPro), no por cron:
--   si un job falla, nadie queda regalado ni cortado por error.
--
--   subscription_payments = comprobantes que sube el comerciante y aprueba el
--   super admin. Mismo flujo que los pagos de un pedido, reusando el bucket
--   privado `payment-proofs` con la ruta <store_id>/subs/<uuid>.<ext>, que ya
--   está cubierta por las policies de 0003_storage.sql.
-- ════════════════════════════════════════════════════════════════════════════

-- ── STORES: columnas de plan ────────────────────────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_source TEXT NOT NULL DEFAULT 'free'
    CHECK (plan_source IN ('free', 'paid', 'comp')),
  ADD COLUMN IF NOT EXISTS plan_note TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_plan ON stores(plan, plan_expires_at);

-- Las tiendas que ya existían al lanzar la monetización se quedan en Pro de
-- cortesía, sin vencimiento. Solo afecta filas anteriores a esta migración:
-- las nuevas nacen 'free' por el DEFAULT.
UPDATE stores
   SET plan = 'pro',
       plan_source = 'comp',
       plan_expires_at = NULL,
       plan_note = COALESCE(plan_note, 'Cortesía de por vida (tienda fundadora)')
 WHERE plan = 'free';

-- ── PLATFORM SETTINGS (fila única) ──────────────────────────────────────────
-- Tus datos de cobro y los precios, editables desde /super/ajustes sin
-- redeploy. El CHECK (id) fuerza que solo exista una fila.
CREATE TABLE IF NOT EXISTS platform_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  pago_movil JSONB NOT NULL DEFAULT '{}',
  zelle JSONB NOT NULL DEFAULT '{}',
  binance JSONB NOT NULL DEFAULT '{}',
  paypal JSONB NOT NULL DEFAULT '{}',
  pro_price_usd NUMERIC(10,2) NOT NULL DEFAULT 5,
  pro_price_yearly_usd NUMERIC(10,2) NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_settings (id, pago_movil, zelle, binance)
VALUES (
  TRUE,
  '{"banco":"Bancaribe","cedula":"10353086","telefono":"04120896444","titular":"Oscar Valery"}',
  '{"email":"ovalery1903@gmail.com","titular":"Oscar Valery"}',
  '{"email_o_id":"ovalery1903@gmail.com"}'
)
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── SUBSCRIPTION PAYMENTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

  period_months INTEGER NOT NULL CHECK (period_months > 0),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL
    CHECK (method IN ('pago_movil', 'zelle', 'binance', 'paypal')),

  reference TEXT,
  proof_url TEXT,                       -- ruta en el bucket privado payment-proofs

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_store
  ON subscription_payments(store_id, created_at DESC);
-- La cola de revisión del super admin.
CREATE INDEX IF NOT EXISTS idx_sub_payments_pending
  ON subscription_payments(created_at)
  WHERE status = 'pending';

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- platform_settings: nadie lo lee por RLS. El panel del comerciante lo sirve
-- un Server Component con service role (así el comerciante ve tus datos de
-- cobro sin que la tabla quede expuesta al cliente).
DROP POLICY IF EXISTS "Super admin manages platform settings" ON platform_settings;
CREATE POLICY "Super admin manages platform settings" ON platform_settings
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- subscription_payments: el dueño LEE lo suyo y nada más. No hay policy de
-- INSERT/UPDATE para authenticated a propósito — las escrituras pasan por
-- server actions con service role, así el comerciante no puede escribirse
-- `status = 'approved'` a sí mismo.
DROP POLICY IF EXISTS "Owner reads own subscription payments" ON subscription_payments;
CREATE POLICY "Owner reads own subscription payments" ON subscription_payments
  FOR SELECT USING (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages subscription payments" ON subscription_payments;
CREATE POLICY "Super admin manages subscription payments" ON subscription_payments
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
