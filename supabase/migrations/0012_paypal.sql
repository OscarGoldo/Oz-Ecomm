-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0012 PayPal payment method
-- Allows the 'paypal' payment method type (online checkout via PayPal/card).
-- Credentials live in payment_methods.details (client_id, secret, sandbox);
-- the secret is stripped server-side before reaching the customer's browser.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_type_check;
ALTER TABLE payment_methods
  ADD CONSTRAINT payment_methods_type_check
  CHECK (type IN ('pago_movil', 'zelle', 'binance', 'cash', 'transfer', 'other', 'paypal'));
