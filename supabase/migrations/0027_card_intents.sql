-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0027  El borrador del pedido mientras el cliente escribe la tarjeta
--
--   Con el Payment Element los campos de la tarjeta se ven apenas el cliente
--   elige "Tarjeta", sin haber tocado ningún botón. Si el pedido se creara ahí,
--   el panel del comerciante se llenaría de pedidos fantasma de gente que solo
--   está mirando cómo se paga. Así que ahora el pedido nace DESPUÉS del cobro.
--
--   Eso abre un agujero que hay que tapar: entre que Stripe cobra y que el
--   navegador nos avisa, el cliente puede cerrar la pestaña. Sin nada guardado,
--   ese cobro no tendría pedido y nadie se enteraría — el mismo desastre mudo
--   que ya vivimos con el webhook mal apuntado (ver docs/stripe.md).
--
--   Por eso el borrador completo (productos, totales, cupón, datos del cliente)
--   se congela acá al preparar el cobro. Después el pedido lo puede materializar
--   cualquiera de los dos caminos, el navegador o el webhook, y el UNIQUE sobre
--   payment_intent_id garantiza que sea uno solo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- El cobro en Stripe. UNIQUE porque es la identidad del intento.
  payment_intent_id TEXT NOT NULL UNIQUE,
  -- Lo que se va a cobrar, en USD. Se compara contra lo que Stripe dice haber
  -- cobrado antes de crear el pedido.
  amount NUMERIC(12,2) NOT NULL,
  -- El pedido entero, listo para insertarse: productos, precios, envío,
  -- descuento y datos del cliente.
  draft JSONB NOT NULL,
  -- Se llena al materializarlo. Su presencia dice "este intento ya es pedido".
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkout_intents_store
  ON checkout_intents(store_id, created_at DESC);

-- Para encontrar rápido los cobros que nunca llegaron a ser pedido.
CREATE INDEX IF NOT EXISTS idx_checkout_intents_huerfanos
  ON checkout_intents(created_at)
  WHERE order_id IS NULL;

ALTER TABLE checkout_intents ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo lo toca el service role. El borrador lleva los datos de
-- contacto del cliente y el detalle de precios; no tiene por qué leerlo nadie
-- desde el navegador, ni siquiera el dueño de la tienda.
