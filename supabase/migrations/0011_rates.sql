-- ════════════════════════════════════════════════════════════════════════════
-- OzShop — 0011 Exchange rates (USDT + paralelo)
-- Adds the parallel rate to the cached market rates, plus a per-store USDT rate
-- and a "rate source" so the merchant can pick which rate converts prices.
-- ════════════════════════════════════════════════════════════════════════════

-- Parallel (paralelo) rate, fetched together with the BCV by the daily cron.
ALTER TABLE bcv_rates
  ADD COLUMN IF NOT EXISTS paralelo NUMERIC(14,4);

-- Per-store USDT/Binance rate (manual) + which rate drives Bs conversion.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS usdt_rate NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS rate_source TEXT NOT NULL DEFAULT 'manual'
    CHECK (rate_source IN ('bcv', 'usdt', 'manual'));

-- Stores already auto-updating from the BCV keep using the BCV as their source.
UPDATE stores SET rate_source = 'bcv' WHERE auto_exchange_rate = TRUE;
