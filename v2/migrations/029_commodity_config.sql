-- 029_commodity_config.sql
-- Expand commodities table with full config columns + reporting units table

BEGIN;

-- ─── Identity columns ────────────────────────────────────────────────────────
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS commodity_class VARCHAR(30) DEFAULT 'grains';
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS ticker_root VARCHAR(10);

-- ─── Trade entry columns ─────────────────────────────────────────────────────
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS trade_price_unit VARCHAR(30);
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS trade_volume_unit VARCHAR(30);
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS price_decimal_places INT DEFAULT 4;

-- ─── Contract spec ───────────────────────────────────────────────────────────
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS point_value NUMERIC;

-- ─── Basis config ────────────────────────────────────────────────────────────
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS basis_unit VARCHAR(30);
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS basis_reference VARCHAR(100);

-- ─── Backfill existing commodities ───────────────────────────────────────────
UPDATE commodities SET
  display_name = name,
  commodity_class = 'grains',
  ticker_root = CASE id
    WHEN 'CORN' THEN 'ZC' WHEN 'SOYBEAN' THEN 'ZS' WHEN 'WHEAT' THEN 'ZW'
    WHEN 'SOYOIL' THEN 'ZL' WHEN 'SOYMEAL' THEN 'ZM' ELSE NULL END,
  trade_price_unit = CASE id
    WHEN 'SOYOIL' THEN 'cents/lb' WHEN 'SOYMEAL' THEN '$/short ton'
    ELSE '$/bu' END,
  trade_volume_unit = unit,
  price_decimal_places = CASE id
    WHEN 'SOYOIL' THEN 2 WHEN 'SOYMEAL' THEN 2 ELSE 4 END,
  point_value = CASE id
    WHEN 'CORN' THEN 50 WHEN 'SOYBEAN' THEN 50 WHEN 'WHEAT' THEN 50
    WHEN 'SOYOIL' THEN 600 WHEN 'SOYMEAL' THEN 100 ELSE NULL END,
  basis_unit = CASE id
    WHEN 'SOYOIL' THEN 'cents/lb' WHEN 'SOYMEAL' THEN '$/short ton'
    ELSE 'cents/bu' END,
  basis_reference = 'CBOT settlement'
WHERE ticker_root IS NULL OR ticker_root = '';

-- ─── Reporting Units Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commodity_units (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commodity_id      VARCHAR(20) NOT NULL REFERENCES commodities(id),
  unit_name         VARCHAR(50) NOT NULL,
  abbreviation      VARCHAR(10) NOT NULL,
  to_trade_unit     NUMERIC NOT NULL,
  from_trade_unit   NUMERIC NOT NULL,
  is_default_report BOOLEAN DEFAULT false,
  sort_order        INT DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, abbreviation)
);

-- ─── Seed reporting units ────────────────────────────────────────────────────
INSERT INTO commodity_units (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit, is_default_report, sort_order) VALUES
  -- Corn: 1 bushel = 0.0254 MT, 1 MT = 39.3683 bushels
  ('CORN', 'Bushels', 'bu', 1, 1, false, 0),
  ('CORN', 'Metric tons', 'MT', 0.0254, 39.3683, true, 1),
  ('CORN', 'Short tons', 'st', 0.025, 40, false, 2),
  -- Soybeans
  ('SOYBEAN', 'Bushels', 'bu', 1, 1, false, 0),
  ('SOYBEAN', 'Metric tons', 'MT', 0.0272, 36.7437, true, 1),
  -- Wheat
  ('WHEAT', 'Bushels', 'bu', 1, 1, false, 0),
  ('WHEAT', 'Metric tons', 'MT', 0.0272, 36.7437, true, 1),
  -- Soybean Oil
  ('SOYOIL', 'Pounds', 'lb', 1, 1, false, 0),
  ('SOYOIL', 'Metric tons', 'MT', 0.000454, 2204.62, true, 1),
  -- Soybean Meal
  ('SOYMEAL', 'Short tons', 'st', 1, 1, false, 0),
  ('SOYMEAL', 'Metric tons', 'MT', 0.9072, 1.1023, true, 1)
ON CONFLICT (commodity_id, abbreviation) DO NOTHING;

COMMIT;
