-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 026: Instrument Types — Futures Details, Options, Swaps
-- Adds per-instrument detail tables. Existing futures fields remain on
-- tc_financial_trades for backward compatibility.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── A) Add columns to tc_financial_trades (common header) ───────────────────

ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS instrument_class VARCHAR(20) DEFAULT 'exchange_traded';
-- Values: 'exchange_traded' (futures, listed options), 'otc' (swaps)

ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS counterparty_id UUID;
-- Soft ref to ct_counterparties. Used for swaps (and OTC options in the future).

ALTER TABLE tc_financial_trades
  ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(200);
-- Denormalized fallback: works even if contracts plugin is off.

-- ─── B) tc_futures_details ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_futures_details (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id         UUID NOT NULL UNIQUE,
  broker           VARCHAR(200),
  account_number   VARCHAR(50),
  exchange         VARCHAR(50) DEFAULT 'CME',
  contract_month   VARCHAR(10) NOT NULL,
  num_contracts    INT NOT NULL,
  contract_size    NUMERIC NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_futures_trade ON tc_futures_details(trade_id);

-- ─── C) tc_option_details ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_option_details (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id            UUID NOT NULL UNIQUE,
  option_type         VARCHAR(10) NOT NULL
    CHECK (option_type IN ('call', 'put')),
  option_style        VARCHAR(20) DEFAULT 'american'
    CHECK (option_style IN ('american', 'european')),
  strike_price        NUMERIC NOT NULL,
  premium             NUMERIC NOT NULL,
  premium_total       NUMERIC,
  expiration_date     DATE NOT NULL,
  underlying_contract VARCHAR(10),
  broker              VARCHAR(200),
  account_number      VARCHAR(50),
  exchange            VARCHAR(50) DEFAULT 'CME',
  exercise_status     VARCHAR(20) DEFAULT 'open'
    CHECK (exercise_status IN ('open', 'exercised', 'expired', 'sold')),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_options_trade ON tc_option_details(trade_id);

-- ─── D) tc_swap_details ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_swap_details (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id            UUID NOT NULL UNIQUE,
  swap_type           VARCHAR(30) NOT NULL DEFAULT 'fixed_for_floating'
    CHECK (swap_type IN ('fixed_for_floating', 'basis')),
  fixed_price         NUMERIC NOT NULL,
  floating_reference  VARCHAR(50) NOT NULL,
  floating_index      VARCHAR(100),
  notional_volume     NUMERIC NOT NULL,
  volume_unit         VARCHAR(20) DEFAULT 'bushels',
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  payment_frequency   VARCHAR(20) DEFAULT 'monthly'
    CHECK (payment_frequency IN ('monthly', 'quarterly', 'at_expiry')),
  settlement_type     VARCHAR(20) DEFAULT 'cash'
    CHECK (settlement_type IN ('cash', 'physical')),
  isda_ref            VARCHAR(100),
  master_agreement    VARCHAR(100),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tc_swaps_trade ON tc_swap_details(trade_id);

-- ─── E) tc_swap_settlements ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tc_swap_settlements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swap_detail_id        UUID NOT NULL,
  trade_id              UUID NOT NULL,
  settlement_date       DATE NOT NULL,
  settlement_period_start DATE NOT NULL,
  settlement_period_end   DATE NOT NULL,
  fixed_price           NUMERIC NOT NULL,
  floating_price        NUMERIC,
  volume                NUMERIC NOT NULL,
  settlement_amount     NUMERIC,
  status                VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'settled', 'disputed')),
  settled_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swap_detail_id, settlement_date)
);

CREATE INDEX IF NOT EXISTS idx_tc_swap_sett_swap ON tc_swap_settlements(swap_detail_id);
CREATE INDEX IF NOT EXISTS idx_tc_swap_sett_trade ON tc_swap_settlements(trade_id);

-- ─── F) Permissions ─────────────────────────────────────────────────────────

INSERT INTO permissions (id, module, action, description) VALUES
  ('trade.create_swap', 'trade', 'create_swap', 'Create OTC swap trades'),
  ('trade.settle_swap', 'trade', 'settle_swap', 'Settle swap periods')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('admin',  'trade.create_swap'),
  ('admin',  'trade.settle_swap'),
  ('trader', 'trade.create_swap'),
  ('trader', 'trade.settle_swap')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
