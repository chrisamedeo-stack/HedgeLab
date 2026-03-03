-- V14: Add contract specification columns to commodities table
-- Makes commodity specs (exchange, futures prefix, contract size, etc.) data-driven

ALTER TABLE commodities ADD COLUMN exchange VARCHAR(20);
ALTER TABLE commodities ADD COLUMN futures_prefix VARCHAR(10);
ALTER TABLE commodities ADD COLUMN contract_size_bu INTEGER;
ALTER TABLE commodities ADD COLUMN bushels_per_mt NUMERIC(10,4);
ALTER TABLE commodities ADD COLUMN contract_months JSONB;
ALTER TABLE commodities ADD COLUMN month_mappings JSONB;
ALTER TABLE commodities ADD COLUMN slug VARCHAR(30);

-- Populate CORN specs
UPDATE commodities
SET exchange         = 'CBOT',
    futures_prefix   = 'ZC',
    contract_size_bu = 5000,
    bushels_per_mt   = 39.3683,
    contract_months  = '["H","K","N","U","Z"]'::jsonb,
    month_mappings   = '{"H":[12,1,2],"K":[3,4],"N":[5,6],"U":[7,8],"Z":[9,10,11]}'::jsonb,
    slug             = 'corn'
WHERE code = 'CORN';

-- Seed SOYBEAN commodity
INSERT INTO commodities (code, name, category, unit_of_measure, currency, hedgeable, active, description,
                         exchange, futures_prefix, contract_size_bu, bushels_per_mt,
                         contract_months, month_mappings, slug, created_at, updated_at)
VALUES ('SOYBEAN', 'Soybeans', 'AGRICULTURAL', 'BUSHEL', 'USD', true, true,
        'CBOT Soybean futures (ZS)',
        'CBOT', 'ZS', 5000, 36.7437,
        '["F","H","K","N","Q","U","X"]'::jsonb,
        '{"F":[11,12,1],"H":[2,3],"K":[4,5],"N":[6,7],"Q":[8],"U":[9],"X":[10,11]}'::jsonb,
        'soybeans',
        NOW(), NOW());

-- Add unique constraint on slug
CREATE UNIQUE INDEX uq_commodity_slug ON commodities (slug) WHERE slug IS NOT NULL;
-- Add unique constraint on futures_prefix
CREATE UNIQUE INDEX uq_commodity_futures_prefix ON commodities (futures_prefix) WHERE futures_prefix IS NOT NULL;
