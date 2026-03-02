-- ═══════════════════════════════════════════════════════════════════════════════
-- Step 4: Trade Capture
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── tc_financial_trades ────────────────────────────────────────────────────
CREATE TABLE tc_financial_trades (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  commodity_id      VARCHAR(20) NOT NULL,
  trade_type        VARCHAR(20) NOT NULL DEFAULT 'futures',
  direction         VARCHAR(10) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'open',
  trade_date        DATE NOT NULL,
  contract_month    VARCHAR(10) NOT NULL,
  broker            VARCHAR(200),
  account_number    VARCHAR(50),
  num_contracts     INT NOT NULL,
  contract_size     NUMERIC NOT NULL,
  total_volume      NUMERIC GENERATED ALWAYS AS (num_contracts * contract_size) STORED,
  trade_price       NUMERIC NOT NULL,
  currency          VARCHAR(3) DEFAULT 'USD',
  commission        NUMERIC DEFAULT 0,
  fees              NUMERIC DEFAULT 0,
  allocated_volume  NUMERIC DEFAULT 0,
  unallocated_volume NUMERIC GENERATED ALWAYS AS (num_contracts * contract_size - allocated_volume) STORED,
  option_type       VARCHAR(10),
  strike_price      NUMERIC,
  premium           NUMERIC,
  expiration_date   DATE,
  rolled_from_id    UUID,
  roll_id           UUID,
  entered_by        UUID,
  external_ref      VARCHAR(100),
  notes             TEXT,
  import_job_id     UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tc_trades_org       ON tc_financial_trades(org_id);
CREATE INDEX idx_tc_trades_commodity ON tc_financial_trades(commodity_id);
CREATE INDEX idx_tc_trades_status    ON tc_financial_trades(status);
CREATE INDEX idx_tc_trades_month     ON tc_financial_trades(contract_month);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tc_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tc_trades_updated_at
  BEFORE UPDATE ON tc_financial_trades
  FOR EACH ROW EXECUTE FUNCTION tc_set_updated_at();

-- ─── Add trade permissions to seed data ─────────────────────────────────────
INSERT INTO permissions (id, module, action, description) VALUES
  ('trade.create', 'trade', 'create', 'Create financial trades'),
  ('trade.read',   'trade', 'read',   'View financial trades'),
  ('trade.update', 'trade', 'update', 'Update financial trades'),
  ('trade.cancel', 'trade', 'cancel', 'Cancel financial trades')
ON CONFLICT (id) DO NOTHING;

-- Grant trade permissions to admin and trader roles
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('admin',   'trade.create'),
  ('admin',   'trade.read'),
  ('admin',   'trade.update'),
  ('admin',   'trade.cancel'),
  ('trader',  'trade.create'),
  ('trader',  'trade.read'),
  ('trader',  'trade.update'),
  ('trader',  'trade.cancel'),
  ('risk_manager', 'trade.read'),
  ('operations',   'trade.read'),
  ('viewer',       'trade.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
