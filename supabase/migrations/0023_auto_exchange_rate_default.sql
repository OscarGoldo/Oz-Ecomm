-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0023  La tasa del BCV se actualiza sola por defecto
--
--   `auto_exchange_rate` venía en FALSE, así que toda tienda nueva arrancaba
--   con tasa a mano. El comerciante la ponía el primer día, se olvidaba, y
--   semanas después vendía con una tasa que ya no existe. Con la inflación de
--   acá eso es plata: o vende por debajo, o el cliente transfiere un monto que
--   no cuadra y le terminan rechazando el pago.
--
--   El cron `/api/cron/bcv` ya corre todos los días y solo tocaba a las tiendas
--   que se habían activado a mano — casi ninguna, porque nada en el panel se lo
--   sugería.
--
--   OJO con lo que esto cambia: la tasa del BCV puede estar por debajo de la
--   que el comerciante venía usando (mucha gente acá vende a una tasa más alta
--   que la oficial). A esas tiendas les van a BAJAR los precios en bolívares
--   desde el próximo cron. Es reversible por tienda desde
--   Ajustes → "Actualizar con el BCV automáticamente", y el panel ahora muestra
--   la tasa vigente en el resumen, así que se nota.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Las tiendas nuevas nacen con la tasa automática.
ALTER TABLE stores
  ALTER COLUMN auto_exchange_rate SET DEFAULT TRUE;

-- 2. Las que ya existen también. Si alguna tienda tiene que quedarse con su
--    tasa a mano, se la excluye acá antes de correr esto, o se apaga después
--    desde su panel.
UPDATE stores
SET auto_exchange_rate = TRUE
WHERE auto_exchange_rate IS DISTINCT FROM TRUE;
