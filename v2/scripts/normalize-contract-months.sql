-- One-time normalization: fix API-pulled contract_month values
-- from letter+year format (H26) to canonical prefix+letter+year (ZCH26)
--
-- Run with: psql $DATABASE_URL -f scripts/normalize-contract-months.sql

BEGIN;

-- CORN: H26 → ZCH26
UPDATE md_prices SET contract_month = 'ZC' || contract_month
WHERE commodity_id = 'CORN' AND source = 'commodity-price-api' AND contract_month !~ '^Z';

-- SOYBEAN: H26 → ZSH26
UPDATE md_prices SET contract_month = 'ZS' || contract_month
WHERE commodity_id = 'SOYBEAN' AND source = 'commodity-price-api' AND contract_month !~ '^Z';

-- WHEAT: H26 → ZWH26
UPDATE md_prices SET contract_month = 'ZW' || contract_month
WHERE commodity_id = 'WHEAT' AND source = 'commodity-price-api' AND contract_month !~ '^Z';

-- SOYOIL: H26 → ZLH26
UPDATE md_prices SET contract_month = 'ZL' || contract_month
WHERE commodity_id = 'SOYOIL' AND source = 'commodity-price-api' AND contract_month !~ '^Z';

-- SOYMEAL: H26 → ZMH26
UPDATE md_prices SET contract_month = 'ZM' || contract_month
WHERE commodity_id = 'SOYMEAL' AND source = 'commodity-price-api' AND contract_month !~ '^Z';

-- Verify
SELECT commodity_id, contract_month, COUNT(*) as rows
FROM md_prices
WHERE source = 'commodity-price-api'
GROUP BY commodity_id, contract_month
ORDER BY commodity_id, contract_month;

COMMIT;
