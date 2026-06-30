-- ════════════════════════════════════════════════════════════════════════════
-- OzShop — 0013 Marketplace payouts
-- Tracks, per PayPal order, the processor fee + net the platform received, and
-- when/how the platform settled that money with the tenant (with proof).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_fee NUMERIC(12,2),   -- PayPal commission (USD)
  ADD COLUMN IF NOT EXISTS payment_net NUMERIC(12,2),   -- net received (USD)
  ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,     -- when the tenant was paid
  ADD COLUMN IF NOT EXISTS payout_proof_url TEXT,       -- proof image (private bucket path)
  ADD COLUMN IF NOT EXISTS payout_reference TEXT;       -- reference / note of the payout

CREATE INDEX IF NOT EXISTS idx_orders_payout
  ON orders(store_id, payment_method_type, paid_out_at);
