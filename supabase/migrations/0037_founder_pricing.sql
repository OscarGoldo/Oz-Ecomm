-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0037  Plan único de US$15 y precio de fundador
--
--   Hasta acá había plan Gratis para siempre y Pro a US$5. Desde ahora una
--   tienda nueva arranca con Pro de prueba (un mes con el código USATIENDIFYYA,
--   7 días sin código), después paga US$15 al mes o US$150 al año, y si deja
--   vencer el plan tiene 7 días de gracia antes de que la tienda quede en pausa.
--
--   A las tiendas que ya existían se les respeta lo que se les prometió:
--   `founder = true`. Para ellas nada cambia: si no pagan, siguen en Gratis
--   para siempre, y Pro les cuesta US$5 al mes o US$50 al año, para siempre.
--   Las reglas viven en src/lib/plans.ts (isFounder, planState, pricesFor).
--
--   Correrla ANTES del deploy. El código trata una tienda sin la columna como
--   fundadora, así que sin la migración nadie queda en pausa por error; pero
--   las tiendas nuevas pagarían US$5 hasta correrla.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS founder BOOLEAN NOT NULL DEFAULT false;

-- Todas las que existen hoy son fundadoras. El DEFAULT false de arriba es para
-- las que se creen de acá en adelante.
UPDATE stores SET founder = true;

-- El código de la portada: un mes de Pro, sin límite de usos ni vencimiento.
-- Se apaga o se cambia desde /super/codigos; si se borra, hay que sacarlo
-- también de LAUNCH_PROMO_CODE en src/lib/promo.ts, que es el que muestra la
-- portada.
INSERT INTO promo_codes (code, months, max_uses, expires_at, active, note)
VALUES ('USATIENDIFYYA', 1, NULL, NULL, true, 'Portada: primer mes gratis')
ON CONFLICT (code) DO NOTHING;

-- Los correos que se le mandan a una tienda nueva cuando se le vence el plan
-- (por vencer, en gracia, por pausarse, en pausa). Una fila por aviso y por
-- vencimiento: el cron diario la inserta antes de mandar el correo, así el
-- mismo aviso no sale dos veces aunque el cron corra de nuevo, pero vuelve a
-- salir si la tienda renueva y otra vez se le vence. Solo la toca el service
-- role (src/lib/plan-notices.ts).
CREATE TABLE IF NOT EXISTS plan_notices (
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('ending', 'grace', 'pause_soon', 'paused')),
  plan_expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (store_id, kind, plan_expires_at)
);

ALTER TABLE plan_notices ENABLE ROW LEVEL SECURITY;
