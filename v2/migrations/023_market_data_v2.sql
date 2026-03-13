-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 023: Market Data v2
-- Adds org_id scoping to existing tables, provider infrastructure, basis prices,
-- calendar spreads, and watchlists.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ADD org_id to md_prices
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE md_prices ADD COLUMN org_id UUID;

UPDATE md_prices
   SET org_id = (SELECT id FROM organizations LIMIT 1)
 WHERE org_id IS NULL;

ALTER TABLE md_prices ALTER COLUMN org_id SET NOT NULL;

-- Drop the old unique constraint (auto-named by Postgres from inline UNIQUE)
ALTER TABLE md_prices
  DROP CONSTRAINT md_prices_commodity_id_contract_month_price_date_price_type_key;

ALTER TABLE md_prices
  ADD CONSTRAINT md_prices_org_commodity_month_date_type_key
  UNIQUE (org_id, commodity_id, contract_month, price_date, price_type);

-- Recreate lookup index with org_id
DROP INDEX IF EXISTS idx_md_prices_lookup;
CREATE INDEX idx_md_prices_lookup
  ON md_prices (org_id, commodity_id, contract_month, price_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ADD org_id to md_forward_curves
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE md_forward_curves ADD COLUMN org_id UUID;

UPDATE md_forward_curves
   SET org_id = (SELECT id FROM organizations LIMIT 1)
 WHERE org_id IS NULL;

ALTER TABLE md_forward_curves ALTER COLUMN org_id SET NOT NULL;

-- Drop the old unique constraint
ALTER TABLE md_forward_curves
  DROP CONSTRAINT md_forward_curves_commodity_id_curve_date_contract_month_key;

ALTER TABLE md_forward_curves
  ADD CONSTRAINT md_forward_curves_org_commodity_date_month_key
  UNIQUE (org_id, commodity_id, curve_date, contract_month);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ADD provider_id to existing tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE md_prices ADD COLUMN provider_id UUID;
ALTER TABLE md_forward_curves ADD COLUMN provider_id UUID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. md_providers — per-org market data provider configuration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE md_providers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID NOT NULL,
  provider_type         VARCHAR(50) NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  is_primary            BOOLEAN DEFAULT false,
  is_active             BOOLEAN DEFAULT true,
  config                JSONB NOT NULL DEFAULT '{}',
  poll_interval_minutes INT DEFAULT 10,
  last_poll_at          TIMESTAMPTZ,
  last_poll_status      VARCHAR(20),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_md_providers_org ON md_providers (org_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. md_symbol_map — maps HedgeLab commodity IDs to provider symbols
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE md_symbol_map (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  provider_id     UUID NOT NULL,
  commodity_id    VARCHAR(20) NOT NULL,
  provider_symbol VARCHAR(50) NOT NULL,
  provider_root   VARCHAR(20),
  symbol_format   VARCHAR(50) DEFAULT 'root_month_year',
  unit            VARCHAR(30),
  price_format    VARCHAR(20) DEFAULT 'decimal',
  multiplier      NUMERIC DEFAULT 1,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, provider_id, commodity_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. md_basis — cash basis prices by location
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE md_basis (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID NOT NULL,
  commodity_id    VARCHAR(20) NOT NULL,
  site_id         UUID,
  location_name   VARCHAR(200),
  basis_date      DATE NOT NULL,
  contract_month  VARCHAR(10) NOT NULL,
  basis_value     NUMERIC NOT NULL,
  cash_price      NUMERIC,
  futures_price   NUMERIC,
  bid_type        VARCHAR(30),
  source          VARCHAR(50) DEFAULT 'manual',
  provider_id     UUID,
  import_job_id   UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_md_basis_org_commodity_date
  ON md_basis (org_id, commodity_id, basis_date DESC);

CREATE INDEX idx_md_basis_site_date
  ON md_basis (site_id, basis_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. md_spreads — calendar spreads
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE md_spreads (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID NOT NULL,
  commodity_id    VARCHAR(20) NOT NULL,
  near_month      VARCHAR(10) NOT NULL,
  far_month       VARCHAR(10) NOT NULL,
  spread_date     DATE NOT NULL,
  spread_value    NUMERIC NOT NULL,
  near_price      NUMERIC,
  far_price       NUMERIC,
  source          VARCHAR(50) DEFAULT 'calculated',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (org_id, commodity_id, near_month, far_month, spread_date)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. md_watchlists — user price board configuration
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE md_watchlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  org_id      UUID NOT NULL,
  name        VARCHAR(100) DEFAULT 'Default',
  items       JSONB NOT NULL DEFAULT '[]',
  is_default  BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. New permissions
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO permissions (id, module, action, description) VALUES
  ('market.upload_prices',    'market', 'upload',  'Upload Excel price files'),
  ('market.manage_providers', 'market', 'manage',  'Configure market data providers')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('admin',  'market.upload_prices'),
  ('admin',  'market.manage_providers'),
  ('trader', 'market.upload_prices')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
