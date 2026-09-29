-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0028  Se quita PayPal
--
--   Desde septiembre de 2026 los pagos online van solo por Stripe (tarjeta,
--   Apple Pay y Google Pay), tanto en el checkout de las tiendas como en el
--   plan Pro. El código de PayPal ya no existe.
--
--   Lo que esto hace es apagar los métodos PayPal que quedaron activos en las
--   tiendas. El código ya los ignora igual (el checkout los filtra y el
--   servidor rechaza crear pedidos con ellos), pero apagarlos deja la base
--   diciendo la verdad.
--
--   Lo que NO hace, a propósito:
--
--    · No borra los métodos. Guardan los datos de cobro del comerciante
--      (payout_method / payout_holder / payout_account), y /super/pagos los
--      necesita para liquidar las ventas que ya se cobraron por PayPal.
--    · No toca los pedidos ni las columnas paypal_* de stores y
--      subscription_payments. Son historial: ventas reales que se hicieron,
--      comisiones que se cobraron. Borrar eso descuadra las finanzas.
--    · No quita 'paypal' de los CHECK. Los pedidos viejos lo tienen y tienen
--      que seguir siendo válidos.
-- ════════════════════════════════════════════════════════════════════════════

UPDATE payment_methods
SET active = false
WHERE type = 'paypal' AND active = true;
