-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0021  Endurecimiento de seguridad pre-lanzamiento
--
--   Cierra los agujeros que la auditoría marcó como CRÍTICOS. El hilo común de
--   todos: RLS decide QUÉ FILAS ve un rol, pero los GRANT deciden QUÉ COLUMNAS
--   y QUÉ VERBOS puede usar. Supabase otorga ALL sobre el schema public a
--   `anon` y `authenticated` por defecto, así que hasta esta migración una
--   política de UPDATE sobre la propia fila era, en la práctica, permiso para
--   reescribir CUALQUIER columna de esa fila — incluido el plan.
--
--   Regla que queda establecida: al rol del tenant se le da el verbo y las
--   columnas mínimas. Todo lo demás pasa por server actions con service role,
--   que es donde vive la lógica de negocio.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- 1. STORES — el comerciante edita su vitrina, no su plan
--    (Auditoría #1) Antes: PATCH /rest/v1/stores {"plan":"pro",
--    "plan_expires_at":null} con el JWT normal = Pro vitalicio gratis.
-- ════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE, DELETE ON stores FROM anon, authenticated;

-- Exactamente las columnas que escriben updateStoreSettings(),
-- updateDeliverySettings() y updateStoreTheme(). Si mañana el panel edita una
-- columna nueva, hay que agregarla acá o el guardado falla con 42501.
GRANT UPDATE (
  name, description, primary_color, logo_url, banner_url,
  whatsapp, instagram, phone, email, address,
  show_bs_prices, exchange_rate, exchange_rate_updated_at, auto_exchange_rate,
  offers_delivery, delivery_note, delivery_fee, free_delivery_min,
  offers_pickup, pickup_address,
  customization
) ON stores TO authenticated;

-- Fuera del alcance del tenant a propósito: slug, active, subscription_status,
-- plan, plan_expires_at, plan_source, plan_note, referral_code,
-- paypal_subscription_id, paypal_subscription_status.
-- Todas se escriben con service role (super admin, webhook, referidos).


-- ════════════════════════════════════════════════════════════════════════════
-- 2. ORDERS / ORDER_ITEMS — nadie escribe pedidos por la API pública
--    (Auditoría #2, y de paso #17)
--
--    Antes: cualquiera con la anon key insertaba un pedido "confirmado" por
--    $1, y el dueño podía reescribir el total o el paid_out_at de un pedido
--    ya cerrado. Todo el camino del pedido (checkout, confirmar pago, cambiar
--    estado, liquidar payout) ya usa createAdminClient(), así que estos
--    permisos no los necesita nadie.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Anyone creates orders" ON orders;
DROP POLICY IF EXISTS "Anyone creates order items" ON order_items;
DROP POLICY IF EXISTS "Owner updates own orders" ON orders;

REVOKE INSERT, UPDATE, DELETE ON orders      FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON order_items FROM anon, authenticated;
-- El seguimiento del pedido del cliente (/pedido/<id>) ya se sirve con service
-- role, así que anon tampoco necesita leer.
REVOKE SELECT ON orders, order_items FROM anon;
-- `authenticated` conserva SELECT: lo acota "Owner reads own orders".


-- ════════════════════════════════════════════════════════════════════════════
-- 3. PRODUCTS / PRODUCT_VARIANTS — el costo de compra deja de ser público
--    (Auditoría #4 y #10) Antes: GET /rest/v1/products?select=name,cost
--    devolvía el margen de todas las tiendas de la plataforma.
--
--    Por qué se elimina la policy pública en vez de tapar solo la columna:
--    RLS es por fila, no por columna, así que "todos ven las filas activas"
--    siempre iba a incluir `cost`. Y un GRANT por columna tampoco alcanzaba,
--    porque cualquiera puede registrar una tienda gratis y volverse
--    `authenticated`. El catálogo público pasa a servirse desde
--    lib/storefront.ts con service role y lista de columnas explícita (sin
--    cost) — el mismo patrón que ya usa el seguimiento de pedidos.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public reads active products" ON products;
DROP POLICY IF EXISTS "Public reads variants of active products" ON product_variants;

REVOKE ALL ON products         FROM anon;
REVOKE ALL ON product_variants FROM anon;
-- `authenticated` conserva todo, acotado por "Owner manages own products" /
-- "Owner manages own variants": el dueño ve el costo del suyo y de nadie más.


-- ════════════════════════════════════════════════════════════════════════════
-- 4. CATEGORÍAS Y MÉTODOS DE PAGO — siguen públicos, pero mueren con la tienda
--    (Auditoría #10)
--
--    Decisión de negocio: los datos de cobro se dejan legibles porque el
--    comerciante venezolano ya los publica en su bio de Instagram. Lo que sí
--    se corrige es que una tienda suspendida desde /super seguía exponiendo
--    todo por la API aunque su storefront ya no cargara.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Public reads active categories" ON categories;
CREATE POLICY "Public reads active categories" ON categories
  FOR SELECT USING (
    active = TRUE
    AND EXISTS (SELECT 1 FROM stores s WHERE s.id = categories.store_id AND s.active)
  );

DROP POLICY IF EXISTS "Public reads active payment methods" ON payment_methods;
CREATE POLICY "Public reads active payment methods" ON payment_methods
  FOR SELECT USING (
    active = TRUE
    AND EXISTS (SELECT 1 FROM stores s WHERE s.id = payment_methods.store_id AND s.active)
  );

REVOKE INSERT, UPDATE, DELETE ON categories      FROM anon;
REVOKE INSERT, UPDATE, DELETE ON payment_methods FROM anon;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. STOCK — reservar al tomar el pedido, no al confirmar el pago
--    (Auditoría #5 y #6)
--
--    `stock_committed` es la marca que hace que todo esto sea seguro: dice si
--    ESTE pedido ya movió inventario. Sin ella no se puede saber si al
--    cancelar hay que devolver algo, ni evitar descontar dos veces cuando el
--    dueño toca "Confirmar" dos veces con mala señal.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS stock_committed BOOLEAN NOT NULL DEFAULT FALSE;

-- Los pedidos que ya existen y que descontaron stock en su momento (todo lo
-- que pasó por confirmado alguna vez) quedan marcados, para que una
-- cancelación futura les devuelva el inventario una sola vez.
UPDATE orders
   SET stock_committed = TRUE
 WHERE stock_committed = FALSE
   AND (confirmed_at IS NOT NULL
        OR status IN ('confirmed', 'preparing', 'in_delivery', 'completed'));

-- Devolución de stock: la contraparte de commit_order_stock(). El llamador se
-- protege con stock_committed, así que un pedido cancelado dos veces no puede
-- inflar el inventario.
CREATE OR REPLACE FUNCTION restore_order_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  item jsonb;
  v_qty int;
  v_pid uuid;
  v_vid uuid;
BEGIN
  FOR item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pid := (item->>'product_id')::uuid;
    v_qty := (item->>'qty')::int;
    v_vid := CASE
      WHEN item->>'variant_id' IS NULL OR item->>'variant_id' = '' THEN NULL
      ELSE (item->>'variant_id')::uuid
    END;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF v_vid IS NOT NULL THEN
      UPDATE product_variants SET stock = stock + v_qty WHERE id = v_vid;
    END IF;
    -- products.stock es el espejo denormalizado: se repone siempre, con o sin
    -- variante, igual que commit_order_stock() lo descuenta siempre.
    UPDATE products SET stock = stock + v_qty WHERE id = v_pid;
  END LOOP;
END;
$fn$;

-- ── Cerrar las RPC de stock ─────────────────────────────────────────────────
-- ESTO ES CRÍTICO Y NO ESTABA EN LA AUDITORÍA ORIGINAL.
--
-- `commit_order_stock()` es SECURITY DEFINER (tiene que serlo, para poder
-- tomar los locks de fila) y vive en el schema `public`, así que PostgREST la
-- expone como POST /rest/v1/rpc/commit_order_stock. En Postgres, EXECUTE sobre
-- una función se otorga a PUBLIC por defecto — es decir que hasta ahora
-- cualquiera con la anon key podía llamarla con los product_id que quisiera y
-- dejar en cero el inventario de cualquier tienda de la plataforma. Saltea RLS
-- por definición.
--
-- Ojo con el detalle que hace que esto funcione: revocar solo `FROM anon,
-- authenticated` NO alcanza, porque el permiso no lo tienen de forma directa
-- sino heredado de PUBLIC. Hay que revocarle a PUBLIC y volver a otorgar
-- explícitamente al único rol que las necesita.
REVOKE ALL ON FUNCTION commit_order_stock(jsonb, boolean)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION restore_order_stock(jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION commit_order_stock(jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION restore_order_stock(jsonb)         TO service_role;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. IDEMPOTENCIA DEL CHECKOUT — un dedo nervioso en 3G no compra dos veces
--    (Auditoría #9)
--
--    La clave la genera el navegador una sola vez al entrar al paso de pago y
--    viaja con cada reintento. El índice UNIQUE es la garantía real: si dos
--    envíos del mismo formulario llegan a la vez, solo uno crea el pedido y el
--    otro recupera el que ya existe.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency
  ON orders(store_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- 7. STORAGE — los límites, donde se cumplen
--    (Auditoría #7, y de paso #23) Antes la policy de subida era literalmente
--    `WITH CHECK (bucket_id = 'payment-proofs')`: sin rol, sin carpeta, sin
--    tamaño. Cualquiera con la anon key podía llenar el bucket.
--
--    Los comprobantes del cliente pasan a subirse con signed upload URL
--    emitida por el servidor (la ruta la arma el servidor, no el navegador),
--    así que la policy de INSERT anónimo ya no hace falta.
-- ════════════════════════════════════════════════════════════════════════════

UPDATE storage.buckets
   SET file_size_limit    = 5242880,  -- 5 MB: alcanza para una foto legible
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
       ]
 WHERE id IN ('payment-proofs', 'store-images');

DROP POLICY IF EXISTS "payment-proofs upload" ON storage.objects;

-- El dueño sigue subiendo a la carpeta de su tienda desde el panel (el
-- comprobante del plan Pro): usuario autenticado, carpeta verificada.
DROP POLICY IF EXISTS "payment-proofs owner upload" ON storage.objects;
CREATE POLICY "payment-proofs owner upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = current_store_id()::text
  );
