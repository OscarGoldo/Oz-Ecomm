-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0024  El cupón se reclama, no se cuenta después
--
--   Antes el checkout hacía `times_used = <valor leído> + 1` después de crear
--   el pedido. Dos cosas mal:
--
--     1. Read-modify-write sin lock: sesenta personas entrando al mismo tiempo
--        leen todas `times_used = 0`, todas pasan la validación de
--        `usage_limit`, y el comerciante regala sesenta descuentos donde había
--        prometido diez. Con un cupón publicado en un estado de WhatsApp eso
--        no es un caso raro, es el caso normal.
--
--     2. Se contaba al final. Aunque el contador fuera atómico, el descuento
--        ya se había aplicado al pedido: el freno llegaba tarde.
--
--   La solución es reclamar el cupo ANTES de insertar el pedido y devolverlo
--   si el pedido no llega a existir. `claim_coupon_use` hace el chequeo y el
--   incremento en la misma sentencia, así que el límite lo garantiza Postgres
--   y no el orden en que corran las peticiones.
-- ════════════════════════════════════════════════════════════════════════════

-- TRUE = te llevaste un cupo. FALSE = el cupón se agotó, rechazá el checkout.
CREATE OR REPLACE FUNCTION claim_coupon_use(p_coupon_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_updated int;
BEGIN
  UPDATE coupons
     SET times_used = times_used + 1
   WHERE id = p_coupon_id
     AND active = TRUE
     -- El límite se evalúa contra el valor de ESTA fila en ESTE momento, con
     -- el lock que toma el propio UPDATE. Es lo que hace imposible pasarse.
     AND (usage_limit IS NULL OR times_used < usage_limit);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$fn$;

-- Devolver el cupo cuando el pedido no llegó a crearse (se agotó el stock, la
-- inserción falló). Nunca baja de cero.
CREATE OR REPLACE FUNCTION release_coupon_use(p_coupon_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE coupons
     SET times_used = GREATEST(0, times_used - 1)
   WHERE id = p_coupon_id;
END;
$fn$;

-- Igual que las RPC de stock: son SECURITY DEFINER y viven en `public`, así
-- que PostgREST las expone. Postgres otorga EXECUTE a PUBLIC por defecto —
-- revocar solo de anon/authenticated NO alcanza, porque el permiso se hereda
-- de PUBLIC. Sin esto, cualquiera con la anon key quema los cupones de
-- cualquier tienda.
REVOKE ALL ON FUNCTION claim_coupon_use(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_coupon_use(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_coupon_use(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION release_coupon_use(uuid) TO service_role;
