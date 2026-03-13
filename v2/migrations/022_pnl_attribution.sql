-- 022: P&L Attribution table for waterfall decomposition
-- Stores daily P&L breakdown by causal bucket

CREATE TABLE IF NOT EXISTS rsk_pnl_attribution (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  attribution_date      DATE NOT NULL,
  commodity_id          VARCHAR(20),
  prior_total_pnl       NUMERIC(16,2) NOT NULL DEFAULT 0,
  current_total_pnl     NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_change          NUMERIC(16,2) GENERATED ALWAYS AS (current_total_pnl - prior_total_pnl) STORED,
  price_change_pnl      NUMERIC(16,2) NOT NULL DEFAULT 0,
  new_trades_pnl        NUMERIC(16,2) NOT NULL DEFAULT 0,
  closed_positions_pnl  NUMERIC(16,2) NOT NULL DEFAULT 0,
  roll_pnl              NUMERIC(16,2) NOT NULL DEFAULT 0,
  basis_pnl             NUMERIC(16,2) NOT NULL DEFAULT 0,
  residual_pnl          NUMERIC(16,2) NOT NULL DEFAULT 0,
  currency              VARCHAR(10) DEFAULT 'USD',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, attribution_date, commodity_id)
);

CREATE INDEX IF NOT EXISTS idx_rsk_pnl_attribution_org_date
  ON rsk_pnl_attribution(org_id, attribution_date DESC);
