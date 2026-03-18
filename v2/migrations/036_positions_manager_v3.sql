-- Migration 036: Positions Manager v3 — New schema tables
-- Creates org_tier_config, org_nodes, portfolios, pm_trades, pm_efp_transactions, org_features

-- 1. Org tier config — hierarchy tier definitions per org
CREATE TABLE org_tier_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  tier_level INTEGER NOT NULL,
  tier_name VARCHAR(50) NOT NULL,
  tier_name_plural VARCHAR(50) NOT NULL,
  is_leaf BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(org_id, tier_level)
);
CREATE INDEX idx_org_tier_config_org ON org_tier_config(org_id);

-- 2. Org nodes — unified org tree (all tiers, self-referencing)
CREATE TABLE org_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  parent_id UUID REFERENCES org_nodes(id),
  tier_level INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_org_nodes_org ON org_nodes(org_id);
CREATE INDEX idx_org_nodes_parent ON org_nodes(parent_id);

-- 3. Portfolios
CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  commodity VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_portfolios_org ON portfolios(org_id);

-- 4. Unified trade/position table
CREATE TABLE pm_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  trade_ref VARCHAR(20) NOT NULL,
  trade_date DATE NOT NULL,
  category VARCHAR(10) NOT NULL CHECK (category IN ('financial', 'physical')),

  -- Common fields
  commodity VARCHAR(50) NOT NULL,
  instrument VARCHAR(20) NOT NULL CHECK (instrument IN (
    'futures', 'swap_otc', 'call_option', 'put_option',
    'fixed_price', 'hta', 'basis', 'index'
  )),
  direction VARCHAR(5) NOT NULL CHECK (direction IN ('long', 'short', 'buy', 'sell')),
  quantity NUMERIC(14,2) NOT NULL,
  portfolio_id UUID,
  site_id UUID,
  budget_month DATE,

  -- Financial fields
  contracts INTEGER,
  contract_month VARCHAR(10),
  trade_price NUMERIC(12,5),
  market_price NUMERIC(12,5),
  strike NUMERIC(12,5),
  put_call CHAR(1) CHECK (put_call IN ('P', 'C')),
  premium NUMERIC(12,5),
  delta NUMERIC(6,4),

  -- Physical fields
  basis NUMERIC(10,5),
  board_month VARCHAR(10),
  flat_price NUMERIC(12,5),
  is_priced BOOLEAN NOT NULL DEFAULT false,
  delivery_location_id UUID,
  logistics_assigned BOOLEAN NOT NULL DEFAULT false,

  -- EFP linkage (soft ref)
  efp_id UUID,

  -- Metadata
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX idx_pm_trades_org ON pm_trades(org_id);
CREATE INDEX idx_pm_trades_site ON pm_trades(site_id);
CREATE INDEX idx_pm_trades_portfolio ON pm_trades(portfolio_id);
CREATE INDEX idx_pm_trades_category ON pm_trades(org_id, category);
CREATE INDEX idx_pm_trades_instrument ON pm_trades(org_id, instrument);

-- 5. EFP transactions (feature-flagged)
CREATE TABLE pm_efp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  financial_trade_id UUID,
  physical_trade_id UUID,
  efp_date DATE NOT NULL,
  efp_price NUMERIC(12,5),
  contracts INTEGER,
  quantity NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);
CREATE INDEX idx_pm_efp_org ON pm_efp_transactions(org_id);

-- 6. Granular feature flags per org
CREATE TABLE org_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  flag_name VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(org_id, flag_name)
);
CREATE INDEX idx_org_features_org ON org_features(org_id);

-- updated_at trigger for pm_trades
CREATE OR REPLACE FUNCTION pm_trades_set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pm_trades_updated_at
  BEFORE UPDATE ON pm_trades
  FOR EACH ROW EXECUTE FUNCTION pm_trades_set_updated_at();

-- Trade ref sequence helper
CREATE SEQUENCE IF NOT EXISTS pm_trade_ref_seq START 1;

CREATE OR REPLACE FUNCTION generate_trade_ref() RETURNS VARCHAR(20) AS $$
BEGIN
  RETURN 'TRD-' || LPAD(nextval('pm_trade_ref_seq')::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Seed default feature flags for demo org
INSERT INTO org_features (org_id, flag_name, enabled)
SELECT '00000000-0000-0000-0000-000000000001', flag, true
FROM unnest(ARRAY[
  'physical_positions', 'efp_module', 'logistics_module',
  'options_trading', 'swap_trading', 'multi_portfolio',
  'org_hierarchy', 'basis_trading', 'index_trading',
  'budget_month', 'roll_action', 'offset_close_action'
]) AS flag
ON CONFLICT (org_id, flag_name) DO NOTHING;

-- Seed org tier config for demo org
INSERT INTO org_tier_config (org_id, tier_level, tier_name, tier_name_plural, is_leaf)
VALUES
  ('00000000-0000-0000-0000-000000000001', 0, 'Corporate', 'Corporate', false),
  ('00000000-0000-0000-0000-000000000001', 1, 'Country', 'Countries', false),
  ('00000000-0000-0000-0000-000000000001', 2, 'Site', 'Sites', true);
