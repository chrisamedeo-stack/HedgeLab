-- Make site_id nullable for month-only allocations (Step 1)
ALTER TABLE corn_hedge_allocations ALTER COLUMN site_id DROP NOT NULL;

-- Replace the existing triple unique constraint with two partial indexes
ALTER TABLE corn_hedge_allocations DROP CONSTRAINT uq_hedge_alloc;

-- Month-only: one allocation per trade + month (when site is NULL)
CREATE UNIQUE INDEX uq_hedge_alloc_month_only
  ON corn_hedge_allocations (hedge_trade_id, budget_month)
  WHERE site_id IS NULL;

-- Site-level: one allocation per trade + site + month (when site is set)
CREATE UNIQUE INDEX uq_hedge_alloc_with_site
  ON corn_hedge_allocations (hedge_trade_id, site_id, budget_month)
  WHERE site_id IS NOT NULL;
