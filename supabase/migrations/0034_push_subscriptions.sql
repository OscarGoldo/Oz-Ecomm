-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0034  Avisos al teléfono del comerciante (Web Push)
--
--   Cada fila es un teléfono (o computadora) donde alguien de la tienda tocó
--   "Activar avisos". El navegador entrega una dirección única en los
--   servidores de Google o Apple (`endpoint`) y dos claves para cifrar el
--   mensaje; con eso Tiendify le manda el aviso de cada pedido nuevo aunque el
--   navegador esté cerrado.
--
--   Se escribe y se lee solo con service role, desde el servidor: el endpoint
--   es una credencial (quien lo tiene le puede mandar avisos a ese teléfono).
--   Cuando Google o Apple responden que la dirección ya no existe (borró los
--   datos, desinstaló), la fila se borra sola al intentar mandar.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Para mostrar "Android · Chrome" y para soporte; no se usa para nada más.
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_store
  ON push_subscriptions(store_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads push subscriptions" ON push_subscriptions;
CREATE POLICY "Super admin reads push subscriptions" ON push_subscriptions
  FOR SELECT USING (is_super_admin());
