-- 016: Add futures_prefix to commodity config so budget auto-maps futures months
-- e.g. budget month 2026-03 for CORN → ZCH26

BEGIN;

UPDATE commodities SET config = jsonb_set(COALESCE(config, '{}'), '{futures_prefix}', '"ZC"')
WHERE id = 'CORN';

UPDATE commodities SET config = jsonb_set(COALESCE(config, '{}'), '{futures_prefix}', '"ZS"')
WHERE id = 'SOYBEAN';

UPDATE commodities SET config = jsonb_set(COALESCE(config, '{}'), '{futures_prefix}', '"ZW"')
WHERE id = 'WHEAT';

UPDATE commodities SET config = jsonb_set(COALESCE(config, '{}'), '{futures_prefix}', '"ZL"')
WHERE id = 'SOYOIL';

UPDATE commodities SET config = jsonb_set(COALESCE(config, '{}'), '{futures_prefix}', '"ZM"')
WHERE id = 'SOYMEAL';

COMMIT;
