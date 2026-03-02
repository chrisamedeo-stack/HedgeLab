-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 004: Market Data (md_ tables)
-- Step 5 of the HedgeLab v2 build — price entry, forward curves, MTM support
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── md_prices: Settlement & market price history (high-volume, append-only) ─
CREATE TABLE md_prices (
  id              BIGSERIAL PRIMARY KEY,
  commodity_id    VARCHAR(20) NOT NULL,
  contract_month  VARCHAR(10) NOT NULL,
  price_date      DATE NOT NULL,
  price_type      VARCHAR(20) NOT NULL DEFAULT 'settlement',
  price           NUMERIC NOT NULL,
  open_price      NUMERIC,
  high_price      NUMERIC,
  low_price       NUMERIC,
  volume          BIGINT,
  open_interest   BIGINT,
  source          VARCHAR(50) DEFAULT 'manual',
  import_job_id   UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, contract_month, price_date, price_type)
);

CREATE INDEX idx_md_prices_lookup
  ON md_prices(commodity_id, contract_month, price_date DESC);

-- ─── md_forward_curves: Forward curve snapshots ─────────────────────────────
CREATE TABLE md_forward_curves (
  id              BIGSERIAL PRIMARY KEY,
  commodity_id    VARCHAR(20) NOT NULL,
  curve_date      DATE NOT NULL,
  contract_month  VARCHAR(10) NOT NULL,
  price           NUMERIC NOT NULL,
  source          VARCHAR(50) DEFAULT 'manual',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, curve_date, contract_month)
);

-- ─── Permissions (idempotent — kernel already seeds market.read + market.enter_price) ─
INSERT INTO permissions (id, module, action, description) VALUES
  ('market.read',        'market', 'read',   'View market prices and curves'),
  ('market.enter_price', 'market', 'create', 'Enter and update market prices')
ON CONFLICT (id) DO NOTHING;

-- Grant to roles (idempotent)
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('admin',        'market.read'),
  ('admin',        'market.enter_price'),
  ('trader',       'market.read'),
  ('trader',       'market.enter_price'),
  ('risk_manager', 'market.read'),
  ('operations',   'market.read'),
  ('viewer',       'market.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
