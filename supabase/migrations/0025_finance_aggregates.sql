-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0025  Las finanzas se agregan en la base, no en Node
--
--   El problema que cierra: `getFinanceSummary()` traía TODOS los pedidos
--   históricos de la tienda y después hacía `.in("order_id", [...])` con ese
--   array para buscar los ítems. Dos fallas encadenadas:
--
--     1. PostgREST corta en 1.000 filas por defecto, en silencio. Pasado el
--        pedido 1.000 el panel de Finanzas mostraba el ingreso de los primeros
--        mil y dejaba de crecer. Sin error, sin aviso: el comerciante tomaba
--        decisiones de precios y de compras con números falsos.
--     2. Mil UUIDs en un filtro `in()` arman una URL de ~40 KB, que además
--        choca contra los límites de tamaño de request.
--
--   Ahora Postgres devuelve los totales ya calculados: una fila, sin techo.
--
--   SEGURIDAD — por qué NO son SECURITY DEFINER:
--   estas funciones reciben un `p_store_id` que viene del servidor, pero si
--   fueran DEFINER saltearían RLS y cualquier comerciante podría pedir las
--   finanzas de otra tienda pasando su id. Como INVOKER (el default), las
--   políticas "Owner reads own orders" y "Owner manages own expenses" siguen
--   aplicando: aunque alguien pase el id de otro, no ve ni una fila.
--
--   ZONA HORARIA: los cortes de mes usan America/Caracas. Antes se calculaban
--   con la hora del servidor (UTC en Vercel), así que los pedidos de las
--   últimas cuatro horas del último día del mes caían en el mes siguiente.
-- ════════════════════════════════════════════════════════════════════════════

-- Estados que cuentan como venta real. Igual que SALES_STATUSES en el código.
CREATE OR REPLACE FUNCTION sales_statuses()
RETURNS text[] LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ARRAY['confirmed', 'preparing', 'in_delivery', 'completed'] $fn$;

-- Identidad del cliente por teléfono: mismos dígitos finales que phoneKey()
-- en src/lib/customer-identity.ts (últimos 9, mínimo 6).
CREATE OR REPLACE FUNCTION phone_key(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE AS
$fn$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
    THEN right(regexp_replace(p_phone, '\D', '', 'g'), 9)
  END
$fn$;


-- ── Resumen de Finanzas (todo el histórico + mes actual y anterior) ─────────
CREATE OR REPLACE FUNCTION finance_summary(p_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
WITH bounds AS (
  SELECT
    date_trunc('month', (now() AT TIME ZONE 'America/Caracas'))
      AT TIME ZONE 'America/Caracas' AS month_start,
    (date_trunc('month', (now() AT TIME ZONE 'America/Caracas')) - interval '1 month')
      AT TIME ZONE 'America/Caracas' AS prev_month_start,
    -- `expenses.spent_at` es DATE, no timestamptz: se compara contra la fecha
    -- local ya truncada, sin pasar por la zona del servidor.
    date_trunc('month', (now() AT TIME ZONE 'America/Caracas'))::date
      AS month_start_date
),
sales AS (
  SELECT o.id, o.total, o.total_bs, o.payment_method_type, o.created_at
  FROM orders o
  WHERE o.store_id = p_store_id
    AND o.status = ANY (sales_statuses())
),
cogs AS (
  SELECT oi.order_id, sum(oi.unit_cost * oi.quantity) AS cost
  FROM order_items oi
  JOIN sales s ON s.id = oi.order_id
  GROUP BY oi.order_id
),
items AS (
  SELECT oi.product_name, oi.quantity, oi.subtotal, oi.unit_cost
  FROM order_items oi
  JOIN sales s ON s.id = oi.order_id
),
totals AS (
  SELECT
    coalesce(sum(s.total), 0)                       AS total_usd,
    coalesce(sum(s.total_bs), 0)                    AS total_bs,
    count(*)                                        AS sales_count,
    coalesce(sum(c.cost), 0)                        AS cogs_usd,
    coalesce(sum(s.total) FILTER (WHERE s.created_at >= b.month_start), 0)   AS month_usd,
    count(*)              FILTER (WHERE s.created_at >= b.month_start)       AS month_count,
    coalesce(sum(c.cost)  FILTER (WHERE s.created_at >= b.month_start), 0)   AS month_cogs_usd,
    coalesce(sum(s.total) FILTER (
      WHERE s.created_at >= b.prev_month_start AND s.created_at < b.month_start
    ), 0)                                           AS prev_month_usd
  FROM sales s
  CROSS JOIN bounds b
  LEFT JOIN cogs c ON c.order_id = s.id
),
units AS (
  SELECT coalesce(sum(quantity), 0) AS units_sold FROM items
),
pending AS (
  SELECT coalesce(sum(o.total), 0) AS pending_usd, count(*) AS pending_count
  FROM orders o
  WHERE o.store_id = p_store_id AND o.status = 'pending_confirmation'
),
exp AS (
  SELECT
    coalesce(sum(e.amount), 0) AS expenses_total_usd,
    coalesce(sum(e.amount) FILTER (
      WHERE e.spent_at >= (SELECT month_start_date FROM bounds)
    ), 0) AS month_expenses_usd
  FROM expenses e
  WHERE e.store_id = p_store_id
),
by_method AS (
  SELECT coalesce(jsonb_agg(m ORDER BY (m->>'usd')::numeric DESC), '[]'::jsonb) AS v
  FROM (
    SELECT jsonb_build_object(
             'type',  coalesce(s.payment_method_type, 'other'),
             'count', count(*),
             'usd',   sum(s.total)
           ) AS m
    FROM sales s
    GROUP BY coalesce(s.payment_method_type, 'other')
  ) t
),
top_products AS (
  SELECT coalesce(jsonb_agg(p ORDER BY (p->>'revenue')::numeric DESC), '[]'::jsonb) AS v
  FROM (
    SELECT jsonb_build_object(
             'name',    i.product_name,
             'qty',     sum(i.quantity),
             'revenue', sum(i.subtotal),
             'profit',  sum(i.subtotal - i.unit_cost * i.quantity)
           ) AS p
    FROM items i
    GROUP BY i.product_name
    ORDER BY sum(i.subtotal) DESC
    LIMIT 5
  ) t
)
SELECT jsonb_build_object(
  'total_usd',          t.total_usd,
  'total_bs',           t.total_bs,
  'sales_count',        t.sales_count,
  'units_sold',         u.units_sold,
  'cogs_usd',           t.cogs_usd,
  'month_usd',          t.month_usd,
  'month_count',        t.month_count,
  'month_cogs_usd',     t.month_cogs_usd,
  'prev_month_usd',     t.prev_month_usd,
  'expenses_total_usd', e.expenses_total_usd,
  'month_expenses_usd', e.month_expenses_usd,
  'pending_usd',        p.pending_usd,
  'pending_count',      p.pending_count,
  'by_method',          bm.v,
  'top_products',       tp.v
)
FROM totals t, units u, pending p, exp e, by_method bm, top_products tp;
$fn$;


-- ── Un rango cualquiera (lo usa el reporte mensual) ─────────────────────────
CREATE OR REPLACE FUNCTION finance_range(
  p_store_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $fn$
WITH sales AS (
  SELECT o.id, o.total, o.total_bs, o.payment_method_type, o.customer_phone
  FROM orders o
  WHERE o.store_id = p_store_id
    AND o.status = ANY (sales_statuses())
    AND o.created_at >= p_from
    AND o.created_at <  p_to
),
items AS (
  SELECT oi.product_name, oi.quantity, oi.subtotal, oi.unit_cost
  FROM order_items oi
  JOIN sales s ON s.id = oi.order_id
),
agg AS (
  SELECT
    coalesce(sum(s.total), 0)    AS income_usd,
    coalesce(sum(s.total_bs), 0) AS income_bs,
    count(*)                     AS sales_count,
    count(DISTINCT phone_key(s.customer_phone)) AS customers
  FROM sales s
),
it AS (
  SELECT
    coalesce(sum(i.unit_cost * i.quantity), 0) AS cogs_usd,
    coalesce(sum(i.quantity), 0)               AS units_sold
  FROM items i
),
exp AS (
  SELECT coalesce(sum(e.amount), 0) AS expenses_usd
  FROM expenses e
  WHERE e.store_id = p_store_id
    AND e.spent_at >= p_from::date
    AND e.spent_at <  p_to::date
),
by_cat AS (
  SELECT coalesce(jsonb_agg(c ORDER BY (c->>'usd')::numeric DESC), '[]'::jsonb) AS v
  FROM (
    SELECT jsonb_build_object(
             'category', coalesce(nullif(e.category, ''), 'Otros'),
             'usd',      sum(e.amount)
           ) AS c
    FROM expenses e
    WHERE e.store_id = p_store_id
      AND e.spent_at >= p_from::date
      AND e.spent_at <  p_to::date
    GROUP BY coalesce(nullif(e.category, ''), 'Otros')
  ) t
),
by_method AS (
  SELECT coalesce(jsonb_agg(m ORDER BY (m->>'usd')::numeric DESC), '[]'::jsonb) AS v
  FROM (
    SELECT jsonb_build_object(
             'type',  coalesce(s.payment_method_type, 'other'),
             'count', count(*),
             'usd',   sum(s.total)
           ) AS m
    FROM sales s
    GROUP BY coalesce(s.payment_method_type, 'other')
  ) t
),
top_products AS (
  SELECT coalesce(jsonb_agg(p ORDER BY (p->>'revenue')::numeric DESC), '[]'::jsonb) AS v
  FROM (
    SELECT jsonb_build_object(
             'name',    i.product_name,
             'qty',     sum(i.quantity),
             'revenue', sum(i.subtotal),
             'profit',  sum(i.subtotal - i.unit_cost * i.quantity)
           ) AS p
    FROM items i
    GROUP BY i.product_name
    ORDER BY sum(i.subtotal) DESC
    LIMIT 5
  ) t
)
SELECT jsonb_build_object(
  'income_usd',          a.income_usd,
  'income_bs',           a.income_bs,
  'sales_count',         a.sales_count,
  'customers',           a.customers,
  'cogs_usd',            i.cogs_usd,
  'units_sold',          i.units_sold,
  'expenses_usd',        e.expenses_usd,
  'expenses_by_category', bc.v,
  'by_method',           bm.v,
  'top_products',        tp.v
)
FROM agg a, it i, exp e, by_cat bc, by_method bm, top_products tp;
$fn$;


-- ── Índices que necesitan estos agregados ───────────────────────────────────
-- El filtro es siempre (store_id, status) recorriendo por fecha.
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created
  ON orders(store_id, status, created_at DESC);

-- El JOIN de order_items contra los pedidos de la tienda.
CREATE INDEX IF NOT EXISTS idx_order_items_order
  ON order_items(order_id);
