-- Migration 021: Unit-agnostic commodity system
-- Adds price_unit and volume_unit columns to commodities table,
-- renames bushels_per_mt → units_per_mt in config JSONB.

ALTER TABLE commodities
  ADD COLUMN IF NOT EXISTS price_unit  VARCHAR(30),
  ADD COLUMN IF NOT EXISTS volume_unit VARCHAR(20) DEFAULT 'MT';

-- Seed price_unit / volume_unit for known commodities
UPDATE commodities SET price_unit = '$/bu',        volume_unit = 'MT' WHERE id = 'CORN';
UPDATE commodities SET price_unit = '$/bu',        volume_unit = 'MT' WHERE id = 'SOYBEAN';
UPDATE commodities SET price_unit = '$/bu',        volume_unit = 'MT' WHERE id = 'WHEAT';
UPDATE commodities SET price_unit = 'cents/lb',    volume_unit = 'MT' WHERE id = 'SOYOIL';
UPDATE commodities SET price_unit = '$/short ton', volume_unit = 'MT' WHERE id = 'SOYMEAL';

-- Rename config key bushels_per_mt → units_per_mt
UPDATE commodities
SET config = (config - 'bushels_per_mt') || jsonb_build_object('units_per_mt', config->'bushels_per_mt')
WHERE config ? 'bushels_per_mt';

-- Seed units_per_mt for all commodities that don't have it yet
UPDATE commodities SET config = jsonb_set(COALESCE(config,'{}'), '{units_per_mt}', '39.3683')  WHERE id='CORN'    AND NOT (COALESCE(config,'{}') ? 'units_per_mt');
UPDATE commodities SET config = jsonb_set(COALESCE(config,'{}'), '{units_per_mt}', '36.7437')  WHERE id='SOYBEAN' AND NOT (COALESCE(config,'{}') ? 'units_per_mt');
UPDATE commodities SET config = jsonb_set(COALESCE(config,'{}'), '{units_per_mt}', '36.7437')  WHERE id='WHEAT'   AND NOT (COALESCE(config,'{}') ? 'units_per_mt');
UPDATE commodities SET config = jsonb_set(COALESCE(config,'{}'), '{units_per_mt}', '2204.62')  WHERE id='SOYOIL'  AND NOT (COALESCE(config,'{}') ? 'units_per_mt');
UPDATE commodities SET config = jsonb_set(COALESCE(config,'{}'), '{units_per_mt}', '1.10231')  WHERE id='SOYMEAL' AND NOT (COALESCE(config,'{}') ? 'units_per_mt');
