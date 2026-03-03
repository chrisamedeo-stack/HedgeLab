-- ============================================================================
-- HedgeLab v2 — Position Manager Migration
-- ============================================================================
-- Creates pm_ tables: allocations, locked_positions, physical_positions,
-- rollovers, rollover_legs, rollover_costs, and position_chains view.
-- ============================================================================


-- ─── 1. Allocations ──────────────────────────────────────────────────────────

CREATE TABLE pm_allocations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID,
  trade_id                  UUID,                   -- soft ref to tc_financial_trades (nullable until Trade Capture)
  site_id                   UUID NOT NULL,           -- soft ref to sites
  commodity_id              VARCHAR(20) NOT NULL,    -- soft ref to commodities
  allocated_volume          NUMERIC NOT NULL,
  budget_month              VARCHAR(10),             -- e.g. '2024-01'
  allocation_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  status                    VARCHAR(20) NOT NULL DEFAULT 'open',
  -- Statuses: open, efp_closed, offset, rolled, cancelled

  -- Trade snapshot (PM works without Trade Capture)
  trade_price               NUMERIC,
  trade_date                DATE,
  contract_month            VARCHAR(10),             -- e.g. 'Z24'
  direction                 VARCHAR(10),             -- long, short
  currency                  VARCHAR(3) DEFAULT 'USD',

  -- EFP fields (denormalized for queries)
  efp_date                  DATE,
  efp_price                 NUMERIC,
  efp_volume                NUMERIC,
  futures_pnl               NUMERIC,

  -- Offset fields
  offset_date               DATE,
  offset_price              NUMERIC,
  offset_volume             NUMERIC,
  offset_pnl                NUMERIC,

  -- Rollover linkage
  rolled_from_allocation_id UUID,
  roll_id                   UUID,                   -- soft ref to pm_rollovers

  allocated_by              UUID,                   -- soft ref to users
  notes                     TEXT,
  import_job_id             UUID,                   -- soft ref to import_jobs
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_alloc_site ON pm_allocations(site_id);
CREATE INDEX idx_pm_alloc_trade ON pm_allocations(trade_id);
CREATE INDEX idx_pm_alloc_status ON pm_allocations(status);
CREATE INDEX idx_pm_alloc_commodity ON pm_allocations(commodity_id);
CREATE INDEX idx_pm_alloc_org_status ON pm_allocations(org_id, status);
CREATE INDEX idx_pm_alloc_site_commodity_month ON pm_allocations(site_id, commodity_id, budget_month);

-- ─── 2. Locked Positions (EFP results) ───────────────────────────────────────

CREATE TABLE pm_locked_positions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id       UUID NOT NULL,               -- soft ref to pm_allocations
  site_id             UUID,                         -- denormalized for query perf
  commodity_id        VARCHAR(20),
  volume              NUMERIC NOT NULL,
  locked_price        NUMERIC NOT NULL,             -- price after EFP execution
  futures_component   NUMERIC,                      -- futures price portion
  basis_component     NUMERIC,                      -- user-provided basis
  futures_pnl         NUMERIC,                      -- realized P&L from EFP
  all_in_price        NUMERIC,                      -- locked + basis + roll costs
  currency            VARCHAR(3) DEFAULT 'USD',
  lock_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_month      VARCHAR(10),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_locked_alloc ON pm_locked_positions(allocation_id);
CREATE INDEX idx_pm_locked_site ON pm_locked_positions(site_id);
CREATE INDEX idx_pm_locked_commodity ON pm_locked_positions(commodity_id);

-- ─── 3. Physical Positions ───────────────────────────────────────────────────

CREATE TABLE pm_physical_positions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID,
  site_id             UUID NOT NULL,               -- soft ref to sites
  commodity_id        VARCHAR(20) NOT NULL,         -- soft ref to commodities
  contract_id         UUID,                         -- soft ref to ct_physical_contracts (if exists)
  direction           VARCHAR(10) NOT NULL,         -- buy, sell
  volume              NUMERIC NOT NULL,
  price               NUMERIC,
  pricing_type        VARCHAR(20) DEFAULT 'fixed',  -- fixed, basis, formula
  basis_price         NUMERIC,
  basis_month         VARCHAR(10),
  delivery_month      VARCHAR(10),
  counterparty        VARCHAR(200),
  currency            VARCHAR(3) DEFAULT 'USD',
  status              VARCHAR(20) NOT NULL DEFAULT 'open',
  -- Statuses: open, filled, cancelled
  import_job_id       UUID,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_phys_site ON pm_physical_positions(site_id);
CREATE INDEX idx_pm_phys_commodity ON pm_physical_positions(commodity_id);
CREATE INDEX idx_pm_phys_org_status ON pm_physical_positions(org_id, status);
CREATE INDEX idx_pm_phys_site_commodity_month ON pm_physical_positions(site_id, commodity_id, delivery_month);

-- ─── 4. Rollovers ────────────────────────────────────────────────────────────

CREATE TABLE pm_rollovers (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                      UUID,
  commodity_id                VARCHAR(20),
  rollover_type               VARCHAR(30) DEFAULT 'contract_month_roll',
  status                      VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Statuses: pending, executed, cancelled
  roll_date                   DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Close leg
  close_month                 VARCHAR(10),
  close_volume                NUMERIC,
  close_price                 NUMERIC,
  close_commodity_id          VARCHAR(20),
  close_realized_pnl          NUMERIC,

  -- Open leg
  open_month                  VARCHAR(10),
  open_volume                 NUMERIC,
  open_price                  NUMERIC,
  open_total_volume           NUMERIC,
  spread_price                NUMERIC,          -- close - open
  spread_cost                 NUMERIC,

  -- Source
  source_type                 VARCHAR(30),      -- 'trade', 'allocation'
  source_trade_id             UUID,
  source_allocation_id        UUID,
  new_trade_id                UUID,
  new_allocation_id           UUID,

  -- Auto-reallocation
  auto_reallocate             BOOLEAN DEFAULT false,
  reallocation_site_id        UUID,
  reallocation_budget_month   VARCHAR(10),

  direction                   VARCHAR(10),
  executed_by                 UUID,
  approved_by                 UUID,
  notes                       TEXT,

  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_roll_org ON pm_rollovers(org_id);
CREATE INDEX idx_pm_roll_source ON pm_rollovers(source_allocation_id);
CREATE INDEX idx_pm_roll_status ON pm_rollovers(status);

-- ─── 5. Rollover Legs ────────────────────────────────────────────────────────

CREATE TABLE pm_rollover_legs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollover_id         UUID NOT NULL,              -- soft ref to pm_rollovers
  leg_type            VARCHAR(10) NOT NULL,        -- 'close', 'open'
  commodity_id        VARCHAR(20),
  contract_month      VARCHAR(10),
  volume              NUMERIC NOT NULL,
  price               NUMERIC,
  num_contracts       INT,
  trade_id            UUID,                        -- soft ref to tc_financial_trades
  allocation_id       UUID,                        -- soft ref to pm_allocations
  realized_pnl        NUMERIC,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_roll_legs_rollover ON pm_rollover_legs(rollover_id);

-- ─── 6. Rollover Costs ──────────────────────────────────────────────────────

CREATE TABLE pm_rollover_costs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rollover_id         UUID NOT NULL,              -- soft ref to pm_rollovers
  spread_cost         NUMERIC DEFAULT 0,
  commission          NUMERIC DEFAULT 0,
  fees                NUMERIC DEFAULT 0,
  total_cost          NUMERIC DEFAULT 0,
  cost_allocation     VARCHAR(20) DEFAULT 'site', -- 'site', 'position'
  site_id             UUID,
  currency            VARCHAR(3) DEFAULT 'USD',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pm_roll_costs_rollover ON pm_rollover_costs(rollover_id);

-- ─── 7. Position Chain View (recursive CTE) ─────────────────────────────────

CREATE OR REPLACE VIEW pm_position_chains AS
WITH RECURSIVE chain AS (
  -- Base: allocations with no rolled_from (originals)
  SELECT
    a.id AS current_id,
    a.id AS original_id,
    a.trade_id AS original_trade_id,
    a.trade_price AS original_price,
    a.contract_month AS original_month,
    a.id AS chain_start_id,
    a.status,
    a.site_id,
    a.commodity_id,
    a.allocated_volume,
    a.contract_month AS current_month,
    a.trade_price AS current_price,
    0 AS roll_count,
    COALESCE(a.trade_price, 0) AS cumulative_pnl,
    0::NUMERIC AS cumulative_roll_cost,
    ARRAY[a.id] AS chain_ids
  FROM pm_allocations a
  WHERE a.rolled_from_allocation_id IS NULL

  UNION ALL

  -- Recursive: follow roll chain
  SELECT
    a.id AS current_id,
    c.original_id,
    c.original_trade_id,
    c.original_price,
    c.original_month,
    c.chain_start_id,
    a.status,
    a.site_id,
    a.commodity_id,
    a.allocated_volume,
    a.contract_month AS current_month,
    a.trade_price AS current_price,
    c.roll_count + 1,
    c.cumulative_pnl + COALESCE(r.close_realized_pnl, 0),
    c.cumulative_roll_cost + COALESCE(rc.total_cost, 0),
    c.chain_ids || a.id
  FROM pm_allocations a
  JOIN chain c ON a.rolled_from_allocation_id = c.current_id
  LEFT JOIN pm_rollovers r ON r.id = a.roll_id
  LEFT JOIN pm_rollover_costs rc ON rc.rollover_id = r.id
)
SELECT * FROM chain;

-- ─── Updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION pm_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pm_allocations_updated
  BEFORE UPDATE ON pm_allocations
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE TRIGGER trg_pm_physical_positions_updated
  BEFORE UPDATE ON pm_physical_positions
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

CREATE TRIGGER trg_pm_rollovers_updated
  BEFORE UPDATE ON pm_rollovers
  FOR EACH ROW EXECUTE FUNCTION pm_set_updated_at();

