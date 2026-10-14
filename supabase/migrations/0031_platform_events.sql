-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0031  Registro de lo que pasa en la plataforma
--
--   Cada cosa que le importa a quien maneja Tiendify (una tienda nueva, un plan
--   pagado, un comprobante, un contracargo) se anota acá UNA vez. De esta tabla
--   salen tres cosas: el aviso al grupo de Telegram, la actividad reciente de
--   /super y, más adelante, la línea de tiempo de cada tienda.
--
--   Se escribe solo con service role, desde el servidor. El super admin la lee
--   por RLS; ningún comerciante la ve.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'store.created', 'plan.paid', 'stripe.dispute'… ver src/lib/platform-events.ts
  type TEXT NOT NULL,
  -- SET NULL y no CASCADE: si se borra una tienda, lo que pasó con ella
  -- (un contracargo, un pago) sigue siendo historia de la plataforma.
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  -- En USD, cuando el evento es de plata.
  amount NUMERIC(12, 2),
  -- Ya escrito en castellano, listo para mostrar: el feed y Telegram no
  -- tienen que saber armar frases.
  title TEXT NOT NULL,
  detail TEXT,
  -- Dónde se actúa: una ruta de /super o un enlace absoluto (Stripe).
  url TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Para lo que se revisa todos los días (un plan que vence): el mismo aviso
  -- no se repite mañana. NULL = no hace falta, cada evento es único.
  dedupe_key TEXT UNIQUE,
  -- Cuándo lo aceptó Telegram. NULL = no se pudo mandar o no está configurado.
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_created
  ON platform_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_store
  ON platform_events(store_id, created_at DESC);

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads platform events" ON platform_events;
CREATE POLICY "Super admin reads platform events" ON platform_events
  FOR SELECT USING (is_super_admin());
