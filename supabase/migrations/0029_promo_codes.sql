-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0029  Códigos promocionales: meses de Pro gratis al registrarse
--
--   Para campañas: se le da un código a un influencer y las primeras N personas
--   que crean su tienda con él arrancan con Pro gratis por unos meses. Los
--   crea el super admin en /super/codigos y se canjean en /crear-tienda.
--
--   No es lo mismo que un referido (0020): ahí premia a quien trae a otro, y
--   recién cuando el otro vende. Acá el regalo es para quien se registra, y lo
--   recibe en el momento.
--
--   El cupo se RECLAMA antes de crear la tienda, con la misma idea que los
--   cupones de 0024: el chequeo del límite y el incremento van en una sola
--   sentencia, así que "las primeras 10" lo garantiza Postgres. Con un código
--   publicado en una historia de Instagram, veinte registros a la vez no es un
--   caso raro, es el caso normal.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Siempre en mayúsculas, solo letras y números. Lo normaliza el servidor
  -- antes de guardar y antes de buscar, así "influ10" e "INFLU 10" son el mismo.
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{3,24}$'),
  -- Meses de Pro que regala.
  months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 24),
  -- Cuántas tiendas lo pueden usar. NULL = sin límite.
  max_uses INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  -- Hasta cuándo se puede canjear. NULL = no vence.
  expires_at TIMESTAMPTZ,
  -- Apagarlo lo deja de aceptar sin borrar quién ya lo usó.
  active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Para qué campaña es. Solo lo ve el super admin.
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quién canjeó cada código.
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  -- UNIQUE: una tienda canjea un solo código, una sola vez.
  store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
  -- Los meses que recibió, por si el código cambia después.
  months INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code
  ON promo_redemptions(promo_code_id, created_at DESC);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;

-- Solo el super admin los ve y los maneja. El registro los consulta y los
-- reclama con service role: nadie con la anon key puede listar los códigos.
DROP POLICY IF EXISTS "Super admin manages promo codes" ON promo_codes;
CREATE POLICY "Super admin manages promo codes" ON promo_codes
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Super admin manages promo redemptions" ON promo_redemptions;
CREATE POLICY "Super admin manages promo redemptions" ON promo_redemptions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Reclama un cupo. Devuelve una fila si te lo llevaste, ninguna si el código no
-- existe, está apagado, venció o se agotó.
CREATE OR REPLACE FUNCTION claim_promo_code(p_code text)
RETURNS TABLE (id uuid, code text, months integer)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE promo_codes p
     SET used_count = p.used_count + 1
   WHERE p.code = upper(trim(p_code))
     AND p.active
     AND (p.expires_at IS NULL OR p.expires_at > NOW())
     -- El límite se evalúa contra el valor de ESTA fila en ESTE momento, con el
     -- lock que toma el propio UPDATE. Es lo que hace imposible pasarse.
     AND (p.max_uses IS NULL OR p.used_count < p.max_uses)
  RETURNING p.id, p.code, p.months;
$fn$;

-- Devuelve el cupo cuando la tienda no llegó a crearse. Nunca baja de cero.
CREATE OR REPLACE FUNCTION release_promo_code(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $fn$
  UPDATE promo_codes
     SET used_count = GREATEST(0, used_count - 1)
   WHERE id = p_id;
$fn$;

-- Igual que las RPC de cupones: Postgres otorga EXECUTE a PUBLIC por defecto.
-- Sin esto, cualquiera con la anon key quema los cupos de una campaña.
REVOKE ALL ON FUNCTION claim_promo_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION release_promo_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_promo_code(text) TO service_role;
GRANT EXECUTE ON FUNCTION release_promo_code(uuid) TO service_role;
