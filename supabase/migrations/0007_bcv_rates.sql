-- ════════════════════════════════════════════════════════════════════════════
-- OzShop — 0007 BCV rates
-- Cached official BCV USD/EUR rates (single row), refreshed daily by a cron.
-- Stores can opt into auto-updating their exchange_rate from the BCV.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS bcv_rates (
  id TEXT PRIMARY KEY DEFAULT 'current',
  usd NUMERIC(14,4),
  eur NUMERIC(14,4),
  source_date TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO bcv_rates (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;

ALTER TABLE bcv_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads bcv rates" ON bcv_rates;
CREATE POLICY "Anyone reads bcv rates" ON bcv_rates FOR SELECT USING (TRUE);
-- Writes happen only via the service role (cron job).

-- Opt-in: auto-update the store's exchange_rate from the BCV each morning.
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS auto_exchange_rate BOOLEAN NOT NULL DEFAULT FALSE;
