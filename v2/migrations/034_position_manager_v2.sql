-- ============================================================================
-- 034 — Position Manager V2: Unified Position Model
-- ============================================================================
-- Consolidates trade headers as positions with a position_status state machine.
-- Hedge Books become first-class settings entities that group positions.
-- ============================================================================

-- ─── 1A. hedge_books table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hedge_books (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  name              VARCHAR(100) NOT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'USD',
  org_unit_id       UUID,
  commodity_id      VARCHAR(20),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  display_order     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_hedge_books_org ON hedge_books (org_id);
CREATE INDEX IF NOT EXISTS idx_hedge_books_org_unit ON hedge_books (org_unit_id) WHERE org_unit_id IS NOT NULL;

-- ─── 1B. New columns on tc_financial_trades ─────────────────────────────────

-- Hedge book assignment
ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS hedge_book_id UUID;

-- Position lifecycle state machine
ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS position_status VARCHAR(30) NOT NULL DEFAULT 'unallocated';

-- Add CHECK constraint for position_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'chk_position_status'
  ) THEN
    ALTER TABLE tc_financial_trades
      ADD CONSTRAINT chk_position_status
      CHECK (position_status IN (
        'unallocated','budget_allocated','site_allocated',
        'exercised','expired','efp','offset','partial'
      ));
  END IF;
END $$;

-- Allocation fields (moved from pm_allocations onto trade header)
ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS budget_month VARCHAR(10),
  ADD COLUMN IF NOT EXISTS site_id UUID;

-- Split support
ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS parent_trade_id UUID,
  ADD COLUMN IF NOT EXISTS is_split_parent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS split_volume NUMERIC(18,4);

-- EFP fields
ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS efp_pair_id UUID,
  ADD COLUMN IF NOT EXISTS efp_basis NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS efp_date DATE,
  ADD COLUMN IF NOT EXISTS efp_market_price NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS linked_physical_id UUID,
  ADD COLUMN IF NOT EXISTS futures_realized_pnl NUMERIC(18,2);

-- Offset fields
ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS offset_pair_id UUID,
  ADD COLUMN IF NOT EXISTS offset_price NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS offset_date DATE,
  ADD COLUMN IF NOT EXISTS realized_pnl NUMERIC(18,2);

CREATE INDEX IF NOT EXISTS idx_ft_hedge_book ON tc_financial_trades (hedge_book_id) WHERE hedge_book_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ft_position_status ON tc_financial_trades (position_status);
CREATE INDEX IF NOT EXISTS idx_ft_parent_trade ON tc_financial_trades (parent_trade_id) WHERE parent_trade_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ft_site ON tc_financial_trades (site_id) WHERE site_id IS NOT NULL;

-- ─── 1C. hedge_book_id on detail tables ─────────────────────────────────────

ALTER TABLE tc_futures_details
  ADD COLUMN IF NOT EXISTS hedge_book_id UUID;

ALTER TABLE tc_option_details
  ADD COLUMN IF NOT EXISTS hedge_book_id UUID;

ALTER TABLE tc_swap_details
  ADD COLUMN IF NOT EXISTS hedge_book_id UUID;

-- ─── 1D. New columns on tc_option_details ───────────────────────────────────

ALTER TABLE tc_option_details
  ADD COLUMN IF NOT EXISTS option_side VARCHAR(10),
  ADD COLUMN IF NOT EXISTS premium_per_unit NUMERIC(10,5),
  ADD COLUMN IF NOT EXISTS exercise_futures_id UUID,
  ADD COLUMN IF NOT EXISTS collar_pair_id UUID,
  ADD COLUMN IF NOT EXISTS parent_option_id UUID;

-- ─── 1E. New columns on ct_physical_contracts ───────────────────────────────

ALTER TABLE ct_physical_contracts
  ADD COLUMN IF NOT EXISTS physical_board_price NUMERIC(16,6),
  ADD COLUMN IF NOT EXISTS physical_board_date DATE,
  ADD COLUMN IF NOT EXISTS physical_pricing_status VARCHAR(20) DEFAULT 'unpriced',
  ADD COLUMN IF NOT EXISTS linked_futures_id UUID;

-- ─── 1F. hedge_book_reassignments table ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS hedge_book_reassignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  trade_header_id UUID NOT NULL,
  from_book_id    UUID NOT NULL,
  to_book_id      UUID NOT NULL,
  reassigned_by   UUID NOT NULL,
  reason          TEXT,
  reassigned_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hbr_trade ON hedge_book_reassignments (trade_header_id);
CREATE INDEX IF NOT EXISTS idx_hbr_org ON hedge_book_reassignments (org_id);

-- ─── 1G. position_events table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS position_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  trade_header_id UUID NOT NULL,
  event_type      VARCHAR(50) NOT NULL,
  from_status     VARCHAR(30),
  to_status       VARCHAR(30),
  performed_by    UUID NOT NULL,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pe_trade ON position_events (trade_header_id);
CREATE INDEX IF NOT EXISTS idx_pe_org ON position_events (org_id);
CREATE INDEX IF NOT EXISTS idx_pe_type ON position_events (event_type);

-- ─── 1H. Backfill existing trades ──────────────────────────────────────────

-- Trades with no allocations → unallocated
UPDATE tc_financial_trades
SET position_status = 'unallocated'
WHERE status = 'open'
  AND position_status = 'unallocated';

-- Fully allocated → site_allocated (assumes allocations had site_id)
UPDATE tc_financial_trades
SET position_status = 'site_allocated'
WHERE status = 'fully_allocated';

-- Partially allocated → stay unallocated (parent will be split later)
UPDATE tc_financial_trades
SET position_status = 'unallocated'
WHERE status = 'partially_allocated';

-- Copy site_id and budget_month from pm_allocations where 1:1 mapping exists
UPDATE tc_financial_trades ft
SET
  site_id = sub.site_id,
  budget_month = sub.budget_month
FROM (
  SELECT trade_id, site_id, budget_month
  FROM pm_allocations
  WHERE status != 'cancelled'
    AND trade_id IS NOT NULL
  GROUP BY trade_id, site_id, budget_month
  HAVING COUNT(*) = 1
) sub
WHERE ft.id = sub.trade_id
  AND ft.site_id IS NULL;

-- ─── 1I. Permissions ────────────────────────────────────────────────────────

INSERT INTO permissions (id, module, action, description)
VALUES
  ('position.manage_books', 'position', 'manage_books', 'Create, edit, and deactivate hedge books'),
  ('position.split', 'position', 'split', 'Split positions into child positions'),
  ('position.exercise', 'position', 'exercise', 'Exercise option positions'),
  ('position.reassign_book', 'position', 'reassign_book', 'Move positions between hedge books')
ON CONFLICT (id) DO NOTHING;

-- ─── Updated_at trigger for hedge_books ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_hedge_books_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hedge_books_updated_at ON hedge_books;
CREATE TRIGGER trg_hedge_books_updated_at
  BEFORE UPDATE ON hedge_books
  FOR EACH ROW EXECUTE FUNCTION update_hedge_books_updated_at();
