-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0039  Lectura del comprobante con IA
--
--   Cada fila es la lectura de UNA captura de pago: lo que la IA sacó de la
--   imagen (monto, referencia, fecha, bancos, a quién se le pagó) y las
--   alertas que salen de compararlo con el pedido. La IA no confirma que la
--   plata llegó: eso solo lo sabe el banco. Lo que hace es frenar la captura
--   falsa o repetida y dejarle al comerciante el dato listo para buscar.
--
--   Una fila por pedido y por captura (UNIQUE): es el candado que evita leer
--   dos veces la misma imagen cuando el cliente y el comerciante abren el
--   pedido a la vez. Si el cliente sube otra captura, es otra fila.
--
--   `reference_key` e `image_hash` existen para encontrar la misma
--   referencia o la misma captura en otro pedido, que es el fraude más común:
--   usar el comprobante de una compra para pagar otra.
--
--   Se escribe y se lee solo con service role, desde el servidor.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_proof_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- La ruta de la captura en el bucket payment-proofs.
  proof_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reading'
    CHECK (status IN ('reading', 'done', 'failed')),
  attempts INT NOT NULL DEFAULT 1,
  -- sha256 de los bytes de la imagen.
  image_hash TEXT,
  -- La referencia leída, sin espacios ni signos (referenceKey en lib/proof-rules).
  reference_key TEXT,
  verdict TEXT CHECK (verdict IN ('ok', 'review', 'suspicious')),
  -- Lo que leyó la IA, tal cual.
  reading JSONB,
  -- Las alertas: [{ "code", "severity", "message" }].
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Por qué falló, para soporte ("budget", "image", "ai").
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, proof_path)
);

CREATE INDEX IF NOT EXISTS idx_proof_checks_reference
  ON payment_proof_checks(reference_key)
  WHERE reference_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proof_checks_image_hash
  ON payment_proof_checks(image_hash)
  WHERE image_hash IS NOT NULL;

ALTER TABLE payment_proof_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin reads proof checks" ON payment_proof_checks;
CREATE POLICY "Super admin reads proof checks" ON payment_proof_checks
  FOR SELECT USING (is_super_admin());
