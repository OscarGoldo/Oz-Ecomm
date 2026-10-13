-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0028  Comentarios de los comerciantes
--
--   Un comerciante no tenía por dónde decirnos que algo no le funciona, no le
--   gusta o le falta: el panel no tenía ni un botón de contacto. Lo que no se
--   dice se convierte en una tienda que deja de entrar sin avisar.
--
--   Acá queda lo que escriben desde /panel/comentarios. Se lee en
--   /super/comentarios, y además llega por correo en el momento.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL y no CASCADE: si la tienda o el usuario se borran, lo que dijeron
  -- sigue sirviendo.
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  -- 'problem' = algo no funciona, 'idea' = una sugerencia, 'other' = lo demás.
  kind TEXT NOT NULL CHECK (kind IN ('problem', 'idea', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  -- NULL = sin leer. Es lo que cuenta el numerito del menú de /super.
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created
  ON feedback(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_sin_leer
  ON feedback(created_at)
  WHERE read_at IS NULL;

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Solo el super admin lee y marca como leído. No hay policy para el
-- comerciante: escribe a través del server action (service role), que es donde
-- se valida el largo y se frena el envío repetido, y no necesita leer la tabla.
DROP POLICY IF EXISTS "Super admin manages feedback" ON feedback;
CREATE POLICY "Super admin manages feedback" ON feedback
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
