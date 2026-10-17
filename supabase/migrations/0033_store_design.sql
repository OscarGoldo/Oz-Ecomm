-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0033  Diseño por secciones (editor v2)
--
--   El diseño de la tienda pasa a ser una lista de secciones (JSON). Tres
--   lugares, a propósito separados:
--
--   · stores.design — lo publicado, lo que ve el público. Vive en `stores`
--     porque la tienda ya lee esa fila en cada visita: cero consultas extra.
--     NULL = nunca publicó con el editor nuevo; se usa `customization` de
--     siempre, traducido a secciones al vuelo.
--
--   · store_design_drafts — el borrador del editor. Tabla aparte y privada: la
--     fila de `stores` es pública (cualquiera la lee con la clave anon), y un
--     borrador puede tener un Black Friday que todavía no se anunció.
--
--   · store_design_versions — cada publicación queda guardada, para volver
--     atrás con un clic.
--
--   Se escriben desde el servidor (service role) después de verificar que la
--   tienda es de quien pide. El dueño puede leer lo suyo por RLS.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE stores ADD COLUMN IF NOT EXISTS design JSONB;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS design_published_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS store_design_drafts (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  design JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_design_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  design JSONB NOT NULL,
  -- Quién publicó. SET NULL: si se borra el usuario, la historia queda.
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_design_versions_store
  ON store_design_versions(store_id, created_at DESC);

ALTER TABLE store_design_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_design_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner reads own design draft" ON store_design_drafts;
CREATE POLICY "Owner reads own design draft" ON store_design_drafts
  FOR SELECT USING (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages design drafts" ON store_design_drafts;
CREATE POLICY "Super admin manages design drafts" ON store_design_drafts
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "Owner reads own design versions" ON store_design_versions;
CREATE POLICY "Owner reads own design versions" ON store_design_versions
  FOR SELECT USING (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages design versions" ON store_design_versions;
CREATE POLICY "Super admin manages design versions" ON store_design_versions
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
