-- 031_commodity_config_v2.sql
-- Expand commodities table with budget mapping, basis convention, volume entry mode

BEGIN;

-- ─── New columns ─────────────────────────────────────────────────────────────

ALTER TABLE commodities ADD COLUMN IF NOT EXISTS volume_entry_mode VARCHAR(20) DEFAULT 'units';
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS basis_sign_convention VARCHAR(30) DEFAULT 'positive_above';
ALTER TABLE commodities ADD COLUMN IF NOT EXISTS futures_budget_mapping JSONB DEFAULT '{}';

-- ─── Backfill existing commodities ───────────────────────────────────────────

UPDATE commodities SET
  display_name = COALESCE(display_name, name),
  commodity_class = CASE WHEN commodity_class IS NULL THEN
    CASE category WHEN 'ag' THEN 'grains' ELSE category END
  ELSE commodity_class END,
  ticker_root = COALESCE(ticker_root, CASE id
    WHEN 'CORN' THEN 'ZC' WHEN 'SOYBEAN' THEN 'ZS' WHEN 'WHEAT' THEN 'ZW'
    WHEN 'SOYOIL' THEN 'ZL' WHEN 'SOYMEAL' THEN 'ZM' ELSE NULL END),
  trade_price_unit = COALESCE(trade_price_unit, CASE id
    WHEN 'SOYOIL' THEN 'cents/lb' WHEN 'SOYMEAL' THEN '$/short ton'
    ELSE '$/bu' END),
  trade_volume_unit = COALESCE(trade_volume_unit, unit),
  price_decimal_places = COALESCE(price_decimal_places, CASE id
    WHEN 'SOYOIL' THEN 2 WHEN 'SOYMEAL' THEN 2 ELSE 4 END),
  point_value = COALESCE(point_value, CASE id
    WHEN 'CORN' THEN 50 WHEN 'SOYBEAN' THEN 50 WHEN 'WHEAT' THEN 50
    WHEN 'SOYOIL' THEN 600 WHEN 'SOYMEAL' THEN 100 ELSE NULL END),
  basis_unit = COALESCE(basis_unit, CASE id
    WHEN 'SOYOIL' THEN 'cents/lb' WHEN 'SOYMEAL' THEN '$/short ton'
    ELSE 'cents/bu' END),
  basis_reference = COALESCE(basis_reference, 'CBOT settlement'),
  futures_budget_mapping = '{"H":[12,1,2],"K":[3,4],"N":[5,6],"U":[7,8],"Z":[9,10,11]}'
WHERE futures_budget_mapping IS NULL OR futures_budget_mapping = '{}';

COMMIT;
