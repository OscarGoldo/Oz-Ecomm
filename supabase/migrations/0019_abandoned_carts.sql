-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0019  Carritos abandonados
--   Captura al cliente que llenó sus datos en el checkout pero no terminó de
--   comprar, para que el comerciante lo recupere por WhatsApp con 1 tap.
--
--   El punto de captura es el paso 1 del checkout (nombre + teléfono válidos):
--   ahí el cliente dio el dato voluntariamente para comprar. Antes de eso no
--   hay nada que guardar.
--
--   Escribe el server action con service role (igual que store_events). El
--   dueño solo LEE lo suyo por RLS; descartar/marcar contactado pasa por
--   server actions que filtran por store_id.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- Mismo id anónimo por navegador que usa analytics (cookie httpOnly `oz_sid`).
  -- Es la clave de deduplicación: un visitante que vuelve al checkout actualiza
  -- su fila en vez de crear una nueva.
  session_id TEXT NOT NULL,

  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  fulfillment_type TEXT,

  -- Foto del carrito al momento de abandonarlo: [{name, variant, qty, price}].
  -- Se guarda desnormalizado a propósito — si el producto cambia de precio o
  -- se archiva, el mensaje de recuperación sigue diciendo lo que el cliente vio.
  items JSONB NOT NULL DEFAULT '[]',
  items_count INTEGER NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Se completa cuando ese mismo visitante termina comprando.
  recovered_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  recovered_at TIMESTAMPTZ,
  -- Última vez que el comerciante le escribió (evita perseguir al cliente).
  last_contacted_at TIMESTAMPTZ,
  -- El comerciante lo archivó a mano.
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un carrito vivo por visitante y tienda. Habilita el upsert del checkout.
  UNIQUE (store_id, session_id)
);

-- La lista del panel: pendientes de la tienda, más recientes primero.
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_pending
  ON abandoned_carts(store_id, updated_at DESC)
  WHERE recovered_at IS NULL AND dismissed_at IS NULL;

-- Marcar como recuperado busca por teléfono dentro de la tienda.
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_phone
  ON abandoned_carts(store_id, customer_phone);

DROP TRIGGER IF EXISTS trg_abandoned_carts_updated_at ON abandoned_carts;
CREATE TRIGGER trg_abandoned_carts_updated_at BEFORE UPDATE ON abandoned_carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- El dueño/staff lee lo de su tienda. No hay policy de INSERT/UPDATE para
-- anon/authenticated: todas las escrituras van por service role.
DROP POLICY IF EXISTS "Owner reads own abandoned carts" ON abandoned_carts;
CREATE POLICY "Owner reads own abandoned carts" ON abandoned_carts
  FOR SELECT USING (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages abandoned carts" ON abandoned_carts;
CREATE POLICY "Super admin manages abandoned carts" ON abandoned_carts
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
