-- V13: Convert all per-bushel prices from ¢/bu to $/bu
-- This migration standardizes the entire system on $/bu.

-- Physical contracts: rename columns and convert values
ALTER TABLE corn_physical_contracts RENAME COLUMN basis_cents_bu TO basis_per_bu;
ALTER TABLE corn_physical_contracts RENAME COLUMN board_price_cents_bu TO board_price_per_bu;
UPDATE corn_physical_contracts SET basis_per_bu = basis_per_bu / 100 WHERE basis_per_bu IS NOT NULL;
UPDATE corn_physical_contracts SET board_price_per_bu = board_price_per_bu / 100 WHERE board_price_per_bu IS NOT NULL;

-- Hedge trades: price_per_bushel convert
UPDATE corn_hedge_trades SET price_per_bushel = price_per_bushel / 100 WHERE price_per_bushel IS NOT NULL;

-- Daily settles: price_per_bushel convert
UPDATE corn_daily_settles SET price_per_bushel = price_per_bushel / 100 WHERE price_per_bushel IS NOT NULL;

-- Hedge offsets: exit_price convert
UPDATE corn_hedge_offsets SET exit_price = exit_price / 100 WHERE exit_price IS NOT NULL;

-- EFP tickets: board_price, entry_price, basis_value convert
UPDATE corn_efp_tickets SET board_price = board_price / 100 WHERE board_price IS NOT NULL;
UPDATE corn_efp_tickets SET entry_price = entry_price / 100 WHERE entry_price IS NOT NULL;
UPDATE corn_efp_tickets SET basis_value = basis_value / 100 WHERE basis_value IS NOT NULL;

-- Budget components: convert ¢/bu rows to $/bu
UPDATE corn_budget_components SET target_value = target_value / 100, unit = '$/bu' WHERE unit = '¢/bu';

-- Recalculate realized_pnl on offsets (was computed from ¢/bu math, now $/bu)
UPDATE corn_hedge_offsets o SET realized_pnl = (
  (o.exit_price - ht.price_per_bushel) * o.lots * 5000
) FROM corn_hedge_trades ht WHERE o.hedge_trade_id = ht.id;
