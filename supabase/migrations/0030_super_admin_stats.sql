-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0030  Los números del super admin se calculan en la base
--
--   El mismo problema que 0025 cerró para el comerciante, ahora del lado de la
--   plataforma. /super traía todas las ventas y todos los productos de todas
--   las tiendas para contarlos en Node, y PostgREST corta en 1.000 filas sin
--   avisar: pasado ese punto "Ventas totales" y "GMV total" dejaban de crecer.
--
--   Y dos números de /super/suscripciones estaban mal aunque no hubiera techo:
--     · el MRR sumaba TODOS los pagos aprobados de cada tienda Pro, así que una
--       tienda con cuatro meses pagados contaba cuatro veces;
--     · "Cobrado histórico" sumaba solo los últimos 100 pagos.
--
--   Acá el MRR es lo que es: por cada tienda que hoy tiene Pro pagado, su
--   ÚLTIMO pago aprobado llevado a un mes.
--
--   Necesita 0025 (usa `sales_statuses()`), 0020 (referidos) y 0029 (códigos).
--
--   SEGURIDAD — por qué SÍ son SECURITY DEFINER (al revés que 0025):
--   leen todas las tiendas y además `auth.users` (el último ingreso de cada
--   dueño), que ningún rol de la API puede leer. A cambio no se le otorga
--   EXECUTE a nadie más que a service_role: solo las llama el servidor, y solo
--   después de `requireSuperAdmin()`.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Una fila por tienda, con todo lo que muestra la tabla de /super/tiendas ──
-- Devuelve un solo jsonb y no un SETOF: una fila por tienda también choca con
-- el techo de 1.000 de PostgREST el día que haya más de mil tiendas.
CREATE OR REPLACE FUNCTION super_store_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
WITH prod AS (
  SELECT p.store_id, count(*) AS products, max(p.updated_at) AS last_product_at
  FROM products p
  GROUP BY p.store_id
),
sales AS (
  SELECT o.store_id,
         count(*)          AS sales,
         sum(o.total)      AS gmv,
         min(o.created_at) AS first_sale_at
  FROM orders o
  WHERE o.status = ANY (sales_statuses())
  GROUP BY o.store_id
),
last_order AS (
  SELECT o.store_id, max(o.created_at) AS last_order_at
  FROM orders o
  GROUP BY o.store_id
),
-- Lo cobrado con tarjeta que todavía no se le pagó a la tienda. Mismo criterio
-- que /super/pagos: sin neto guardado (ventas viejas) vale el total.
owed AS (
  SELECT o.store_id, sum(coalesce(o.payment_net, o.total)) AS owed
  FROM orders o
  WHERE o.status = ANY (sales_statuses())
    AND o.payment_method_type IN ('stripe', 'paypal')
    AND o.paid_out_at IS NULL
  GROUP BY o.store_id
),
paid AS (
  SELECT sp.store_id, sum(sp.amount) AS paid_total
  FROM subscription_payments sp
  WHERE sp.status = 'approved'
  GROUP BY sp.store_id
),
-- La persona detrás de la tienda. Con más de un dueño queda el primero que se
-- registró, igual que hacía la lista vieja.
own AS (
  SELECT DISTINCT ON (u.store_id) u.store_id, u.id, u.full_name, u.email
  FROM users u
  WHERE u.role = 'store_owner' AND u.store_id IS NOT NULL
  ORDER BY u.store_id, u.created_at
),
promo AS (
  SELECT r.store_id, c.code
  FROM promo_redemptions r
  JOIN promo_codes c ON c.id = r.promo_code_id
),
ref AS (
  SELECT r.referred_store_id AS store_id, s.name AS referrer_name
  FROM referrals r
  JOIN stores s ON s.id = r.referrer_store_id
)
SELECT coalesce(
  jsonb_agg(
    jsonb_build_object(
      'id',                         s.id,
      'slug',                       s.slug,
      'name',                       s.name,
      'whatsapp',                   s.whatsapp,
      'active',                     s.active,
      'subscription_status',        s.subscription_status,
      'plan',                       s.plan,
      'plan_source',                s.plan_source,
      'plan_expires_at',            s.plan_expires_at,
      'plan_note',                  s.plan_note,
      'stripe_subscription_status', s.stripe_subscription_status,
      'paypal_subscription_status', s.paypal_subscription_status,
      'created_at',                 s.created_at,
      'owner_name',                 own.full_name,
      'owner_email',                own.email,
      'last_sign_in_at',            au.last_sign_in_at,
      -- "Última actividad" y no solo el último ingreso: quien deja la sesión
      -- abierta en el teléfono no vuelve a "ingresar" en semanas, y marcarlo
      -- como dormido con pedidos entrando sería una falsa alarma.
      'last_activity_at',           greatest(
                                      au.last_sign_in_at,
                                      lo.last_order_at,
                                      prod.last_product_at
                                    ),
      'products',                   coalesce(prod.products, 0),
      'sales',                      coalesce(sales.sales, 0),
      'gmv',                        coalesce(sales.gmv, 0),
      'first_sale_at',              sales.first_sale_at,
      'last_order_at',              lo.last_order_at,
      'paid_total',                 coalesce(paid.paid_total, 0),
      'owed',                       coalesce(owed.owed, 0),
      'promo_code',                 promo.code,
      'referred_by',                ref.referrer_name
    )
    ORDER BY s.created_at DESC
  ),
  '[]'::jsonb
)
FROM stores s
LEFT JOIN prod          ON prod.store_id  = s.id
LEFT JOIN sales         ON sales.store_id = s.id
LEFT JOIN last_order lo ON lo.store_id    = s.id
LEFT JOIN owed          ON owed.store_id  = s.id
LEFT JOIN paid          ON paid.store_id  = s.id
LEFT JOIN own           ON own.store_id   = s.id
LEFT JOIN auth.users au ON au.id          = own.id
LEFT JOIN promo         ON promo.store_id = s.id
LEFT JOIN ref           ON ref.store_id   = s.id;
$fn$;


-- ── Los totales de la plataforma: un período contra el anterior ─────────────
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
  FROM stores s
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
  CROSS JOIN b
  WHERE p.status = 'approved'
),
pend AS (
  SELECT count(*) AS pending_subs, coalesce(sum(p.amount), 0) AS pending_subs_usd
  FROM subscription_payments p
  WHERE p.status = 'pending'
),
-- El último pago de cada tienda que hoy paga, llevado a un mes. Un anual de
-- $50 aporta $4,17, no $50, y cuatro mensuales de $5 aportan $5, no $20.
mrr AS (
  SELECT coalesce(sum(lp.amount / lp.period_months), 0) AS mrr
  FROM stores s
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
  CROSS JOIN b
  WHERE o.status = ANY (sales_statuses())
),
owed AS (
  SELECT
    coalesce(sum(coalesce(o.payment_net, o.total)), 0) AS owed,
    count(DISTINCT o.store_id)                         AS owed_stores
  FROM orders o
  WHERE o.status = ANY (sales_statuses())
    AND o.payment_method_type IN ('stripe', 'paypal')
    AND o.paid_out_at IS NULL
),
prod AS (
  SELECT count(*) AS products_total,
         count(DISTINCT p.store_id) AS stores_with_products
  FROM products p
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


-- Postgres otorga EXECUTE a PUBLIC por defecto. Sin esto, cualquiera con la
-- anon key se lleva la lista completa de tiendas con el correo de cada dueño.
REVOKE ALL ON FUNCTION super_store_stats() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION super_overview(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION super_store_stats() TO service_role;
GRANT EXECUTE ON FUNCTION super_overview(integer) TO service_role;
