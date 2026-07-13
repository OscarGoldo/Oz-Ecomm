-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0014
--  1. commit_order_stock(): atomic, guarded stock decrement to prevent
--     overselling under concurrent checkouts (fixes race in checkout/actions).
--  2. signup_attempts: per-IP throttle table for public store signups.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Atomic stock commit ───────────────────────────────────────────────────
-- p_items: jsonb array of { product_id, variant_id (nullable), qty }.
-- p_enforce = true  → each decrement is guarded (stock >= qty); if any item is
--                     short the whole call raises and rolls back (nothing is
--                     decremented). Use for unpaid, immediately-confirmed orders
--                     (cash) so we never oversell.
-- p_enforce = false → decrement is floored at 0 and never fails. Use when the
--                     money is already captured (PayPal) — we must not reject a
--                     paid order; an occasional oversell is reconciled manually.
-- Runs inside a single transaction (plpgsql function) and takes row locks via
-- UPDATE, so concurrent callers serialize on the same product/variant row.
CREATE OR REPLACE FUNCTION commit_order_stock(p_items jsonb, p_enforce boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  v_qty int;
  v_pid uuid;
  v_vid uuid;
  v_updated int;
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
      IF p_enforce THEN
        UPDATE product_variants SET stock = stock - v_qty
          WHERE id = v_vid AND stock >= v_qty;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        IF v_updated = 0 THEN
          RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001';
        END IF;
      ELSE
        UPDATE product_variants SET stock = GREATEST(0, stock - v_qty)
          WHERE id = v_vid;
      END IF;
      -- Keep the denormalized products.stock mirror in sync.
      UPDATE products SET stock = GREATEST(0, stock - v_qty) WHERE id = v_pid;
    ELSE
      IF p_enforce THEN
        UPDATE products SET stock = stock - v_qty
          WHERE id = v_pid AND stock >= v_qty;
        GET DIAGNOSTICS v_updated = ROW_COUNT;
        IF v_updated = 0 THEN
          RAISE EXCEPTION 'insufficient_stock' USING ERRCODE = 'P0001';
        END IF;
      ELSE
        UPDATE products SET stock = GREATEST(0, stock - v_qty) WHERE id = v_pid;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ── 2. Signup throttle (per-IP) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signup_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signup_attempts_ip_time
  ON signup_attempts(ip, created_at DESC);

-- Only the service role (which bypasses RLS) touches this table. Enable RLS with
-- no policies so the anon/authenticated roles can never read or write it.
ALTER TABLE signup_attempts ENABLE ROW LEVEL SECURITY;
