-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0018  Suscripción recurrente de PayPal
--
--   Decisión de diseño: `plan_expires_at` SIGUE SIENDO LA VERDAD del plan.
--   Cada cobro exitoso que avisa PayPal lo extiende un período. La suscripción
--   es metadato encima: sirve para mostrar "se renueva sola el X" y para
--   ofrecer cancelar.
--
--   Por qué así y no "el plan vale mientras la suscripción esté activa":
--     · Los candados (isPro) no cambian ni una línea.
--     · Pago Móvil no puede renovarse solo. Con este modelo conviven los dos
--       sin ramas paralelas: los dos terminan sumando meses.
--     · Si un webhook se pierde, la tienda mantiene lo que ya pagó en vez de
--       apagarse de golpe.
--
--   Al cancelar NO se revoca nada: el plan corre hasta donde estaba pago.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  -- 'active' | 'suspended' | 'cancelled' | 'expired' — espejo de PayPal.
  ADD COLUMN IF NOT EXISTS paypal_subscription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_stores_paypal_sub
  ON stores(paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

-- Cada cobro (el primero y cada renovación) queda registrado acá.
ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT;

-- ── Dedupe de webhooks ──────────────────────────────────────────────────────
-- PayPal reintenta un webhook hasta que le respondas 200, y puede mandar el
-- mismo evento más de una vez. Sin esto, un reintento de un cobro extendería
-- el plan dos veces. El id del evento como PK es la garantía: el segundo
-- INSERT choca con 23505 y el handler corta antes de tocar nada.
CREATE TABLE IF NOT EXISTS paypal_webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Limpieza: los eventos viejos ya no pueden llegar como reintento.
CREATE INDEX IF NOT EXISTS idx_webhook_events_time
  ON paypal_webhook_events(processed_at);

ALTER TABLE paypal_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo lo toca el service role desde la ruta del webhook.
