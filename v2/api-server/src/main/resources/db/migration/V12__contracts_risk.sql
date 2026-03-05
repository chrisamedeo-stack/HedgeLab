-- ============================================================================
-- HedgeLab v2 — Migration 012: Contracts & Risk
-- ============================================================================
-- Adds:
--   1. ct_counterparties — counterparty registry
--   2. ct_physical_contracts — full contract lifecycle with delivery tracking
--   3. rsk_mtm_snapshots — daily mark-to-market by commodity
--   4. rsk_position_limits — configurable position limits
--   5. rsk_limit_checks — audit trail of limit check results
--   6. Enable contracts + risk plugins for demo org
--   7. Seed counterparty-related permissions
-- ============================================================================

BEGIN;

-- ─── 1. Counterparty Registry ──────────────────────────────────────────────

CREATE TABLE ct_counterparties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  name VARCHAR(200) NOT NULL,
  short_name VARCHAR(50),
  counterparty_type VARCHAR(50) NOT NULL DEFAULT 'commercial',
  credit_limit NUMERIC(16,2),
  credit_rating VARCHAR(20),
  payment_terms_days INTEGER DEFAULT 30,
  contact_name VARCHAR(200),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(50),
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ct_counterparties_org ON ct_counterparties(org_id);
CREATE INDEX idx_ct_counterparties_active ON ct_counterparties(org_id, is_active);

-- ─── 2. Physical Contracts ─────────────────────────────────────────────────

CREATE TABLE ct_physical_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  counterparty_id UUID,
  commodity_id UUID,
  site_id UUID,
  contract_ref VARCHAR(100),
  contract_type VARCHAR(20) NOT NULL DEFAULT 'purchase',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  pricing_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
  direction VARCHAR(10) NOT NULL DEFAULT 'buy',
  total_volume NUMERIC(16,4) NOT NULL,
  delivered_volume NUMERIC(16,4) NOT NULL DEFAULT 0,
  remaining_volume NUMERIC(16,4) GENERATED ALWAYS AS (total_volume - delivered_volume) STORED,
  price NUMERIC(16,6),
  basis_price NUMERIC(16,6),
  basis_month VARCHAR(10),
  formula_id UUID,
  currency VARCHAR(10) DEFAULT 'USD',
  delivery_start DATE,
  delivery_end DATE,
  delivery_location TEXT,
  payment_terms_days INTEGER,
  incoterms VARCHAR(20),
  quality_specs JSONB DEFAULT '{}',
  notes TEXT,
  entered_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_ct_contract_type CHECK (contract_type IN ('purchase', 'sale')),
  CONSTRAINT chk_ct_status CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  CONSTRAINT chk_ct_pricing CHECK (pricing_type IN ('fixed', 'basis', 'formula')),
  CONSTRAINT chk_ct_direction CHECK (direction IN ('buy', 'sell')),
  CONSTRAINT chk_ct_volume CHECK (total_volume > 0),
  CONSTRAINT chk_ct_delivered CHECK (delivered_volume >= 0 AND delivered_volume <= total_volume)
);

CREATE INDEX idx_ct_contracts_org ON ct_physical_contracts(org_id);
CREATE INDEX idx_ct_contracts_status ON ct_physical_contracts(org_id, status);
CREATE INDEX idx_ct_contracts_counterparty ON ct_physical_contracts(counterparty_id);
CREATE INDEX idx_ct_contracts_commodity ON ct_physical_contracts(commodity_id);

-- ─── 3. MTM Snapshots ──────────────────────────────────────────────────────

CREATE TABLE rsk_mtm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  commodity_id UUID,
  futures_pnl NUMERIC(16,2) NOT NULL DEFAULT 0,
  physical_pnl NUMERIC(16,2) NOT NULL DEFAULT 0,
  total_pnl NUMERIC(16,2) GENERATED ALWAYS AS (futures_pnl + physical_pnl) STORED,
  net_position NUMERIC(16,4) NOT NULL DEFAULT 0,
  realized_pnl NUMERIC(16,2) NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC(16,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'USD',
  market_price NUMERIC(16,6),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_rsk_mtm_unique ON rsk_mtm_snapshots(org_id, snapshot_date, commodity_id);
CREATE INDEX idx_rsk_mtm_org_date ON rsk_mtm_snapshots(org_id, snapshot_date DESC);

-- ─── 4. Position Limits ────────────────────────────────────────────────────

CREATE TABLE rsk_position_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  commodity_id UUID,
  limit_type VARCHAR(30) NOT NULL DEFAULT 'net',
  limit_value NUMERIC(16,4) NOT NULL,
  alert_threshold NUMERIC(5,2) NOT NULL DEFAULT 80.00,
  direction VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rsk_limit_type CHECK (limit_type IN ('net', 'long', 'short', 'gross', 'concentration')),
  CONSTRAINT chk_rsk_limit_value CHECK (limit_value > 0),
  CONSTRAINT chk_rsk_alert CHECK (alert_threshold > 0 AND alert_threshold <= 100)
);

CREATE INDEX idx_rsk_limits_org ON rsk_position_limits(org_id);
CREATE INDEX idx_rsk_limits_active ON rsk_position_limits(org_id, is_active);

-- ─── 5. Limit Check Audit Trail ────────────────────────────────────────────

CREATE TABLE rsk_limit_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  limit_id UUID NOT NULL,
  check_date TIMESTAMPTZ DEFAULT NOW(),
  current_value NUMERIC(16,4) NOT NULL,
  limit_value NUMERIC(16,4) NOT NULL,
  utilization_pct NUMERIC(7,2) NOT NULL,
  result VARCHAR(20) NOT NULL DEFAULT 'ok',
  details JSONB DEFAULT '{}',
  checked_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_rsk_check_result CHECK (result IN ('ok', 'warning', 'breached'))
);

CREATE INDEX idx_rsk_checks_org ON rsk_limit_checks(org_id);
CREATE INDEX idx_rsk_checks_limit ON rsk_limit_checks(limit_id);
CREATE INDEX idx_rsk_checks_date ON rsk_limit_checks(org_id, check_date DESC);

-- ─── 6. Enable plugins for demo org ────────────────────────────────────────

INSERT INTO org_plugins (org_id, id, display_name, is_enabled) VALUES
  ('00000000-0000-0000-0000-000000000001', 'contracts', 'Physical Contracts', true),
  ('00000000-0000-0000-0000-000000000001', 'risk', 'Risk Management', true)
ON CONFLICT (org_id, id) DO UPDATE SET is_enabled = true;

-- ─── 7. Seed permissions ───────────────────────────────────────────────────

INSERT INTO permissions (id, module, description) VALUES
  ('contract.view', 'contracts', 'View physical contracts'),
  ('contract.create', 'contracts', 'Create physical contracts'),
  ('contract.update', 'contracts', 'Update physical contracts'),
  ('contract.delete', 'contracts', 'Delete/cancel physical contracts'),
  ('counterparty.view', 'contracts', 'View counterparties'),
  ('counterparty.create', 'contracts', 'Create counterparties'),
  ('counterparty.update', 'contracts', 'Update counterparties'),
  ('counterparty.delete', 'contracts', 'Delete counterparties'),
  ('risk.view', 'risk', 'View risk data'),
  ('risk.mtm', 'risk', 'Run mark-to-market'),
  ('risk.limits', 'risk', 'Manage position limits'),
  ('risk.limit_check', 'risk', 'Run limit checks')
ON CONFLICT (id) DO NOTHING;

-- Grant to admin and trader roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name IN ('admin', 'trader')
  AND p.module IN ('contracts', 'risk')
ON CONFLICT DO NOTHING;

COMMIT;
