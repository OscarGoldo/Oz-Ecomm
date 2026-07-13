-- ════════════════════════════════════════════════════════════════════════════
-- Tiendify — 0002 Row Level Security
-- Each store owner sees only their tenant's data. Public (anonymous) visitors
-- can read the storefront-facing rows. Super admins see everything.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Helper functions (SECURITY DEFINER => can read users without recursion) ──
CREATE OR REPLACE FUNCTION current_store_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT store_id FROM users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- ── Enable RLS ───────────────────────────────────────────────────────────────
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ── USERS ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users read own row" ON users;
CREATE POLICY "Users read own row" ON users
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Super admin manages users" ON users;
CREATE POLICY "Super admin manages users" ON users
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── STORES ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public reads active stores" ON stores;
CREATE POLICY "Public reads active stores" ON stores
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "Owner reads own store" ON stores;
CREATE POLICY "Owner reads own store" ON stores
  FOR SELECT USING (id = current_store_id());

DROP POLICY IF EXISTS "Owner updates own store" ON stores;
CREATE POLICY "Owner updates own store" ON stores
  FOR UPDATE USING (id = current_store_id())
  WITH CHECK (id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages stores" ON stores;
CREATE POLICY "Super admin manages stores" ON stores
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── CATEGORIES ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public reads active categories" ON categories;
CREATE POLICY "Public reads active categories" ON categories
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "Owner manages own categories" ON categories;
CREATE POLICY "Owner manages own categories" ON categories
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages categories" ON categories;
CREATE POLICY "Super admin manages categories" ON categories
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── PRODUCTS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public reads active products" ON products;
CREATE POLICY "Public reads active products" ON products
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Owner manages own products" ON products;
CREATE POLICY "Owner manages own products" ON products
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages products" ON products;
CREATE POLICY "Super admin manages products" ON products
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── PAYMENT METHODS ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public reads active payment methods" ON payment_methods;
CREATE POLICY "Public reads active payment methods" ON payment_methods
  FOR SELECT USING (active = TRUE);

DROP POLICY IF EXISTS "Owner manages own payment methods" ON payment_methods;
CREATE POLICY "Owner manages own payment methods" ON payment_methods
  FOR ALL USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages payment methods" ON payment_methods;
CREATE POLICY "Super admin manages payment methods" ON payment_methods
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── ORDERS ───────────────────────────────────────────────────────────────────
-- Anonymous customers create orders at checkout (guest checkout).
DROP POLICY IF EXISTS "Anyone creates orders" ON orders;
CREATE POLICY "Anyone creates orders" ON orders
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = store_id AND s.active = TRUE)
  );

DROP POLICY IF EXISTS "Owner reads own orders" ON orders;
CREATE POLICY "Owner reads own orders" ON orders
  FOR SELECT USING (store_id = current_store_id());

DROP POLICY IF EXISTS "Owner updates own orders" ON orders;
CREATE POLICY "Owner updates own orders" ON orders
  FOR UPDATE USING (store_id = current_store_id())
  WITH CHECK (store_id = current_store_id());

DROP POLICY IF EXISTS "Super admin manages orders" ON orders;
CREATE POLICY "Super admin manages orders" ON orders
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ── ORDER ITEMS ──────────────────────────────────────────────────────────────
-- Items can be inserted as part of a checkout when the parent order exists.
DROP POLICY IF EXISTS "Anyone creates order items" ON order_items;
CREATE POLICY "Anyone creates order items" ON order_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id)
  );

DROP POLICY IF EXISTS "Owner reads own order items" ON order_items;
CREATE POLICY "Owner reads own order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_id AND o.store_id = current_store_id()
    )
  );

DROP POLICY IF EXISTS "Super admin manages order items" ON order_items;
CREATE POLICY "Super admin manages order items" ON order_items
  FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());

-- NOTE: guest order-tracking reads (/pedido/[id]) are served via a trusted
-- server action using the service-role client, so no public SELECT policy on
-- orders is required. Added in Phase 4.
