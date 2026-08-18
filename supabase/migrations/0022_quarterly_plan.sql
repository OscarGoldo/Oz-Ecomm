-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0022  Plan Pro por 3 meses
--
--   Por qué existe el trimestre: en Venezuela el que paga por Pago Móvil o
--   Zelle no tiene renovación automática — cada mes es una transferencia, un
--   comprobante y una revisión manual. El trimestre es el punto medio real
--   entre "no me quiero atar un año" y "no quiero hacer esto todos los meses".
--
--   El precio es una columna y no una fórmula, igual que el anual, para poder
--   moverlo sin redeploy. Arranca en 15 = 3 × el mensual, o sea SIN descuento.
--   Para ponerle uno:
--
--     UPDATE platform_settings SET pro_price_quarterly_usd = 13;
--
--   La UI muestra el ahorro sola en cuanto el precio por mes quede por debajo
--   del mensual; si no hay descuento, no inventa uno.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE platform_settings
  ADD COLUMN IF NOT EXISTS pro_price_quarterly_usd NUMERIC(10,2) NOT NULL DEFAULT 15;
