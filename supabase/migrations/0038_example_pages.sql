-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0038  Páginas ejemplo y tiendas que no son de comerciantes
--
--   Dos marcas nuevas en `stores`:
--
--   · demo    — la tienda no es de un comerciante real: no cuenta en los
--               números de /super, ni en el resumen de Telegram, ni en el
--               puntaje de crédito, y no va al mapa del sitio. La llevan las
--               tiendas de prueba de los socios y todas las páginas ejemplo.
--
--   · example — página ejemplo que los socios arman desde /super/ejemplos para
--               mostrársela a un negocio antes de venderle ("mira, tu tienda
--               se puede ver así"). No tiene dueño ni cuenta: se edita y se
--               borra desde el super admin, no toma pedidos y lleva una franja
--               que dice que es un ejemplo. Toda página ejemplo es demo.
--
--   Las dos se escriben solo con service role: 0021 deja al comerciante
--   actualizar una lista cerrada de columnas, y estas no están en ella.
--
--   Correrla ANTES del deploy: el código nuevo filtra por `demo`.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS example BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_example_is_demo;
ALTER TABLE stores
  ADD CONSTRAINT stores_example_is_demo CHECK (NOT example OR demo);

-- Las tiendas de prueba de los socios. Antes vivían como lista de enlaces en
-- src/lib/credit-score.ts (CREDIT_EXCLUDED_SLUGS) y solo salían del crédito.
UPDATE stores
   SET demo = true
 WHERE slug IN ('alfa-electronic', 'retro-mania', 'ozzie-steaks', 'abigaile', 'ovejita', 'mr-cleaner');


-- ── super_overview sin las tiendas demo ─────────────────────────────────────
-- La misma función de 0030; lo único que cambia es que cada parte cuenta solo
-- las tiendas reales. `super_store_stats` no se toca: devuelve todas y el
-- servidor separa las demo (src/lib/super-stats.ts), igual que con `founder`.
CREATE OR REPLACE FUNCTION super_overview(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH b AS (
  SELECT
    now() - make_interval(days => greatest(p_days, 1))     AS cur_from,
    now() - make_interval(days => greatest(p_days, 1) * 2) AS prev_from
),
real_stores AS (
  SELECT * FROM stores WHERE NOT demo
),
st AS (
  SELECT
    count(*)                                           AS stores,
    count(*) FILTER (WHERE s.active)                   AS active_stores,
    count(*) FILTER (WHERE s.created_at >= b.cur_from) AS new_stores,
    count(*) FILTER (
      WHERE s.created_at >= b.prev_from AND s.created_at < b.cur_from
    )                                                  AS new_stores_prev,
    -- Pro vigente: mismo criterio que isPro() en src/lib/plans.ts.
    count(*) FILTER (
      WHERE s.plan = 'pro' AND s.plan_source = 'paid'
        AND (s.plan_expires_at IS NULL OR s.plan_expires_at > now())
    )                                                  AS paying,
    count(*) FILTER (
      WHERE s.plan = 'pro' AND s.plan_source = 'comp'
        AND (s.plan_expires_at IS NULL OR s.plan_expires_at > now())
    )                                                  AS comped
  FROM real_stores s
  CROSS JOIN b
),
pay AS (
  SELECT
    coalesce(sum(p.amount), 0)           AS collected_total,
    coalesce(sum(coalesce(p.fee, 0)), 0) AS fees_total,
    coalesce(sum(p.amount) FILTER (WHERE p.created_at >= b.cur_from), 0)
                                         AS collected,
    coalesce(sum(coalesce(p.fee, 0)) FILTER (WHERE p.created_at >= b.cur_from), 0)
                                         AS fees,
    coalesce(sum(p.amount) FILTER (
      WHERE p.created_at >= b.prev_from AND p.created_at < b.cur_from
    ), 0)                                AS collected_prev,
    coalesce(sum(coalesce(p.fee, 0)) FILTER (
      WHERE p.created_at >= b.prev_from AND p.created_at < b.cur_from
    ), 0)                                AS fees_prev
  FROM subscription_payments p
  JOIN real_stores rs ON rs.id = p.store_id
  CROSS JOIN b
  WHERE p.status = 'approved'
),
pend AS (
  SELECT count(*) AS pending_subs, coalesce(sum(p.amount), 0) AS pending_subs_usd
  FROM subscription_payments p
  JOIN real_stores rs ON rs.id = p.store_id
  WHERE p.status = 'pending'
),
-- El último pago de cada tienda que hoy paga, llevado a un mes. Un anual de
-- $50 aporta $4,17, no $50, y cuatro mensuales de $5 aportan $5, no $20.
mrr AS (
  SELECT coalesce(sum(lp.amount / lp.period_months), 0) AS mrr
  FROM real_stores s
  JOIN LATERAL (
    SELECT p.amount, p.period_months
    FROM subscription_payments p
    WHERE p.store_id = s.id AND p.status = 'approved'
    ORDER BY p.created_at DESC
    LIMIT 1
  ) lp ON true
  WHERE s.plan = 'pro' AND s.plan_source = 'paid'
    AND (s.plan_expires_at IS NULL OR s.plan_expires_at > now())
),
gmv AS (
  SELECT
    coalesce(sum(o.total), 0)  AS gmv_total,
    count(*)                   AS sales_total,
    count(DISTINCT o.store_id) AS stores_with_sale,
    coalesce(sum(o.total) FILTER (WHERE o.created_at >= b.cur_from), 0) AS gmv,
    coalesce(sum(o.total) FILTER (
      WHERE o.created_at >= b.prev_from AND o.created_at < b.cur_from
    ), 0)                      AS gmv_prev
  FROM orders o
  JOIN real_stores rs ON rs.id = o.store_id
  CROSS JOIN b
  WHERE o.status = ANY (sales_statuses())
),
owed AS (
  SELECT
    coalesce(sum(coalesce(o.payment_net, o.total)), 0) AS owed,
    count(DISTINCT o.store_id)                         AS owed_stores
  FROM orders o
  JOIN real_stores rs ON rs.id = o.store_id
  WHERE o.status = ANY (sales_statuses())
    AND o.payment_method_type IN ('stripe', 'paypal')
    AND o.paid_out_at IS NULL
),
prod AS (
  SELECT count(*) AS products_total,
         count(DISTINCT p.store_id) AS stores_with_products
  FROM products p
  JOIN real_stores rs ON rs.id = p.store_id
)
SELECT jsonb_build_object(
  'stores',               st.stores,
  'active_stores',        st.active_stores,
  'new_stores',           st.new_stores,
  'new_stores_prev',      st.new_stores_prev,
  'paying',               st.paying,
  'comped',               st.comped,
  'stores_with_products', prod.stores_with_products,
  'stores_with_sale',     gmv.stores_with_sale,
  'products_total',       prod.products_total,
  'mrr',                  mrr.mrr,
  'collected_total',      pay.collected_total,
  'fees_total',           pay.fees_total,
  'collected',            pay.collected,
  'fees',                 pay.fees,
  'collected_prev',       pay.collected_prev,
  'fees_prev',            pay.fees_prev,
  'pending_subs',         pend.pending_subs,
  'pending_subs_usd',     pend.pending_subs_usd,
  'gmv_total',            gmv.gmv_total,
  'sales_total',          gmv.sales_total,
  'gmv',                  gmv.gmv,
  'gmv_prev',             gmv.gmv_prev,
  'owed',                 owed.owed,
  'owed_stores',          owed.owed_stores
)
FROM st, pay, pend, mrr, gmv, owed, prod;
$fn$;

-- CREATE OR REPLACE conserva los permisos de 0030, pero se repiten por si la
-- función se hubiera recreado a mano: sin esto la anon key podría llamarla.
REVOKE ALL ON FUNCTION super_overview(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION super_overview(integer) TO service_role;
