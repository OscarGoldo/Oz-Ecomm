-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0026  Stripe Checkout (tiendas + plan Pro)
--
--   Mismo modelo que PayPal: UNA cuenta de la plataforma para todas las
--   tiendas, y lo que se le debe a cada comerciante se liquida en /super/pagos
--   con las columnas payment_fee / payment_net / paid_out_at que ya existen
--   desde la 0013. Stripe no reparte plata solo: eso sería Connect, otro
--   proyecto entero con KYC por tienda.
--
--   Diferencia importante con PayPal: el checkout de Stripe es una REDIRECCIÓN.
--   El cliente se va del sitio, así que el pedido tiene que existir ANTES de
--   que se vaya (nace en 'pending_payment') y se confirma cuando llega el
--   webhook. Por eso hacen falta las dos columnas de abajo: son el hilo que
--   une la sesión de Stripe con el pedido cuando el cliente ya no está.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. El método de pago 'stripe' ───────────────────────────────────────────
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;
ALTER TABLE payment_methods
  ADD CONSTRAINT payment_methods_type_check
  CHECK (type IN ('pago_movil', 'zelle', 'binance', 'cash', 'transfer', 'other', 'paypal', 'stripe'));

-- ── 2. El pedido ────────────────────────────────────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT;

-- Para encontrar el pedido desde el webhook.
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session
  ON orders(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- UNIQUE a propósito: es la defensa contra confirmar dos veces el mismo cobro
-- si Stripe reintenta el webhook o llegan dos eventos del mismo pago.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_intent
  ON orders(stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;

-- ── 3. El plan Pro ──────────────────────────────────────────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_stripe_subscription
  ON stores(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE subscription_payments DROP CONSTRAINT IF EXISTS subscription_payments_method_check;
ALTER TABLE subscription_payments
  ADD CONSTRAINT subscription_payments_method_check
  CHECK (method IN ('pago_movil', 'zelle', 'binance', 'paypal', 'stripe'));

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Mismo candado que paypal_capture_id (0017): un cobro se registra una sola
-- vez, así un reintento del webhook no regala meses de nuevo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_payments_stripe
  ON subscription_payments(stripe_payment_id)
  WHERE stripe_payment_id IS NOT NULL;

-- ── 4. Dedupe de eventos del webhook ────────────────────────────────────────
-- Espejo de paypal_webhook_events (0018). Stripe reintenta hasta recibir un
-- 200, y sin esto cada reintento volvería a ejecutar el evento.
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_time
  ON stripe_webhook_events(processed_at);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo lo toca el service role desde la ruta del webhook.
