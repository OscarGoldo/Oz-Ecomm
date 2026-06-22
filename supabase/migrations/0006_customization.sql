-- ════════════════════════════════════════════════════════════════════════════
-- Oz Ecom — 0006 Storefront customization
-- Per-tenant theme config (colors, font, sections, texts) as a JSON blob.
-- Defaults are applied in code, so NULL = default theme.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS customization JSONB;
