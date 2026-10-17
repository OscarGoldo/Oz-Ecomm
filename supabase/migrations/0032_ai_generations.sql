-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0032  Diseños generados con IA
--
--   Cada vez que un comerciante le pide a la IA que le diseñe la tienda queda
--   una fila acá. Sirve para dos cosas: el tope diario por tienda (cada
--   generación cuesta plata de verdad) y saber cuánto se está gastando.
--
--   Se escribe y se lee solo con service role, desde el servidor. Ningún
--   comerciante la ve; el super admin la lee por RLS.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- 'design' por ahora. Queda abierto para lo que venga (textos, fotos…).
  kind TEXT NOT NULL DEFAULT 'design',
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  -- false = la llamada falló o la respuesta no sirvió. También cuenta para el
  -- tope: un error repetido no puede ser una puerta para gastar sin límite.
  ok BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_generations_store_time
  ON ai_generations(store_id, created_at DESC);

ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads ai generations" ON ai_generations;
CREATE POLICY "Super admin reads ai generations" ON ai_generations
  FOR SELECT USING (is_super_admin());
