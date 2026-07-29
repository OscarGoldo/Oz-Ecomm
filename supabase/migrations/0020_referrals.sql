-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0020  Referidos comerciante-a-comerciante
--   El emprendedor que trae a otro emprendedor gana un mes de Pro. Es el canal
--   de adquisición más barato que hay: cuesta un mes de plan, no plata.
--
--   Cómo se gana el mes (regla de negocio, implementada en src/lib/referrals):
--   la tienda referida tiene que ACTIVARSE de verdad — ≥3 productos activos y
--   ≥1 pedido confirmado. Premiar el registro solo sería regalar meses a quien
--   cree tiendas vacías, y premiar el primer pedido a secas es faqueable: el
--   comerciante confirma sus propios pedidos. Las dos condiciones juntas son
--   caras de falsificar y alcanzables para una tienda real.
--
--   El premio se acredita solo, con tope (ver REWARD_CAP_PER_30D). Lo que pasa
--   el tope queda en 'qualified' esperando aprobación en /super/referidos.
--
--   Igual que subscription_payments: el dueño solo LEE lo suyo. No hay policy
--   de INSERT/UPDATE para tenants — todas las escrituras van por server actions
--   con service role, así nadie se acredita meses a sí mismo.
-- ════════════════════════════════════════════════════════════════════════════

-- ── CÓDIGO DE REFERIDO POR TIENDA ───────────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS referral_code TEXT;

-- Sin caracteres ambiguos (0/O, 1/I/L): el código se dicta por WhatsApp y por
-- teléfono, y "confundí un cero con una O" es un ticket de soporte evitable.
CREATE OR REPLACE FUNCTION gen_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate TEXT;
  i INTEGER;
  j INTEGER;
BEGIN
  -- 31^8 combinaciones: chocar es casi imposible, pero como esto corre como
  -- DEFAULT de una columna UNIQUE, una colisión sería un registro fallido.
  -- Diez intentos y listo.
  FOR i IN 1..10 LOOP
    candidate := '';
    FOR j IN 1..8 LOOP
      candidate := candidate ||
        substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM stores WHERE referral_code = candidate) THEN
      RETURN candidate;
    END IF;
  END LOOP;
  -- Salida de emergencia: único por construcción.
  RETURN 'R' || upper(replace(gen_random_uuid()::text, '-', ''));
END;
$$;

-- Las tiendas que ya existen se quedan sin código hasta acá; se lo damos ahora.
-- Fila por fila y no con un UPDATE masivo a propósito: dentro de una sola
-- sentencia, el chequeo de colisión de la función no vería los códigos que esa
-- misma sentencia acaba de escribir, y dos tiendas podrían quedar iguales.
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM stores WHERE referral_code IS NULL LOOP
    UPDATE stores SET referral_code = gen_referral_code() WHERE id = s.id;
  END LOOP;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_referral_code
  ON stores(referral_code);

-- El DEFAULT se pone DESPUÉS del backfill para que la función ya vea los
-- códigos existentes al chequear colisiones. Importa que sea DEFAULT y no algo
-- del código de registro: las tiendas también se crean desde /super/tiendas.
ALTER TABLE stores
  ALTER COLUMN referral_code SET DEFAULT gen_referral_code();
ALTER TABLE stores
  ALTER COLUMN referral_code SET NOT NULL;

-- Nota: `referral_code` viaja en el `select *` público del storefront. No es un
-- secreto — usar el código de otro solo le REGALA un referido a ese otro.

-- ── REFERRALS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  referrer_store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- UNIQUE: una tienda se puede referir UNA sola vez en su vida. Es el freno
  -- más importante contra el farmeo — sin esto, todo lo demás es decoración.
  referred_store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,

  -- El código tal cual se usó, aunque después la tienda cambie el suyo.
  code_used TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified', 'rewarded', 'rejected')),
  reward_months INTEGER NOT NULL DEFAULT 1 CHECK (reward_months > 0),

  -- IP del registro de la tienda referida. No bloquea nada por sí sola (hay
  -- oficinas y cybers con IP compartida), pero deja ver granjas desde /super.
  signup_ip TEXT,

  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  note TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT referral_not_self CHECK (referrer_store_id <> referred_store_id)
);

-- La lista del comerciante, y también la ventana de 30 días del tope.
CREATE INDEX IF NOT EXISTS idx_referrals_referrer
  ON referrals(referrer_store_id, created_at DESC);
-- La cola de revisión del super admin.
CREATE INDEX IF NOT EXISTS idx_referrals_qualified
  ON referrals(created_at)
  WHERE status = 'qualified';

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- El que refiere ve a quién trajo y en qué va. La tienda referida NO ve nada:
-- que te hayan referido no es asunto tuyo, y evita conversaciones raras.
DROP POLICY IF EXISTS "Owner reads own referrals" ON referrals;
CREATE POLICY "Owner reads own referrals" ON referrals
  FOR SELECT USING (referrer_store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages referrals" ON referrals;
CREATE POLICY "Super admin manages referrals" ON referrals
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
