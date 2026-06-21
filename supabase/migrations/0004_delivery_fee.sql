-- ════════════════════════════════════════════════════════════════════════════
-- Oz Ecom — 0004 Delivery fee
-- Optional flat delivery fee per store, with an optional free-delivery
-- threshold. Orders snapshot the shipping cost applied.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Subtotal (USD) at/above which delivery is free. NULL = no free threshold.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS free_delivery_min NUMERIC(12,2);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(12,2) NOT NULL DEFAULT 0;
