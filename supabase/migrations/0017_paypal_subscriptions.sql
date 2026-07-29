-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0017  Pago del plan Pro por PayPal / tarjeta
--
--   Reusa la Orders API que ya existe para el checkout de las tiendas
--   (src/lib/paypal.ts): cobro único con captura, no suscripción recurrente.
--   La diferencia con el pago por comprobante es que acá no hay revisión
--   manual — si PayPal devuelve COMPLETED, el plan se activa solo.
--
--   `paypal_capture_id` es UNIQUE a propósito: es la defensa contra procesar
--   dos veces la misma captura (doble clic, reintento de red, F5) y regalar
--   meses dobles. El insert falla con 23505 y la acción corta ahí.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  -- Comisión de PayPal y neto recibido, para saber qué entró de verdad.
  ADD COLUMN IF NOT EXISTS fee NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS net NUMERIC(12,2);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_payments_capture
  ON subscription_payments(paypal_capture_id)
  WHERE paypal_capture_id IS NOT NULL;
