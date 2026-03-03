-- 005_budget.sql — Budget & Forecast Module
-- Tables: bgt_periods, bgt_line_items, bgt_versions, bgt_comparisons

-- ─── Budget Periods ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bgt_periods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL,
  site_id       UUID NOT NULL,
  commodity_id  UUID NOT NULL,
  budget_year   INT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  approved_by   UUID,
  approved_at   TIMESTAMPTZ,
  locked_at     TIMESTAMPTZ,
  notes         TEXT,
  import_job_id UUID,
  currency      VARCHAR(10) NOT NULL DEFAULT 'USD',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, commodity_id, budget_year)
);

CREATE INDEX IF NOT EXISTS idx_bgt_periods_org ON bgt_periods(org_id);
CREATE INDEX IF NOT EXISTS idx_bgt_periods_site ON bgt_periods(site_id);
CREATE INDEX IF NOT EXISTS idx_bgt_periods_commodity ON bgt_periods(commodity_id);
CREATE INDEX IF NOT EXISTS idx_bgt_periods_year ON bgt_periods(budget_year);

-- ─── Budget Line Items ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bgt_line_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           UUID NOT NULL REFERENCES bgt_periods(id) ON DELETE CASCADE,
  budget_month        VARCHAR(10) NOT NULL,
  budgeted_volume     NUMERIC NOT NULL DEFAULT 0,
  budget_price        NUMERIC,
  budget_cost         NUMERIC GENERATED ALWAYS AS (budgeted_volume * COALESCE(budget_price, 0)) STORED,
  committed_volume    NUMERIC NOT NULL DEFAULT 0,
  committed_avg_price NUMERIC,
  committed_cost      NUMERIC NOT NULL DEFAULT 0,
  hedged_volume       NUMERIC NOT NULL DEFAULT 0,
  hedged_avg_price    NUMERIC,
  hedged_cost         NUMERIC NOT NULL DEFAULT 0,
  total_covered_volume NUMERIC GENERATED ALWAYS AS (committed_volume + hedged_volume) STORED,
  coverage_pct        NUMERIC GENERATED ALWAYS AS (
    CASE WHEN budgeted_volume > 0
      THEN ROUND(((committed_volume + hedged_volume) / budgeted_volume) * 100, 2)
      ELSE 0
    END
  ) STORED,
  open_volume         NUMERIC GENERATED ALWAYS AS (
    GREATEST(budgeted_volume - committed_volume - hedged_volume, 0)
  ) STORED,
  forecast_volume     NUMERIC,
  forecast_price      NUMERIC,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_id, budget_month)
);

CREATE INDEX IF NOT EXISTS idx_bgt_line_items_period ON bgt_line_items(period_id);
CREATE INDEX IF NOT EXISTS idx_bgt_line_items_month ON bgt_line_items(budget_month);

-- ─── Budget Version Snapshots ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bgt_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id      UUID NOT NULL REFERENCES bgt_periods(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_name   VARCHAR(100),
  snapshot       JSONB NOT NULL,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(period_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_bgt_versions_period ON bgt_versions(period_id);

-- ─── Budget Comparisons ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bgt_comparisons (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  comparison_items JSONB NOT NULL,
  created_by       UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Permissions ───────────────────────────────────────────────────────────────
INSERT INTO permissions (id, module, action, description) VALUES
  ('budget.read',    'budget', 'read',    'View budget periods and line items'),
  ('budget.create',  'budget', 'create',  'Create new budget periods'),
  ('budget.update',  'budget', 'update',  'Update budget line items'),
  ('budget.submit',  'budget', 'submit',  'Submit budget for approval'),
  ('budget.approve', 'budget', 'approve', 'Approve submitted budgets'),
  ('budget.lock',   'budget', 'lock',    'Lock approved budgets'),
  ('budget.unlock', 'budget', 'unlock',  'Unlock locked budgets')
ON CONFLICT (id) DO NOTHING;

-- ─── Role Grants ───────────────────────────────────────────────────────────────
-- Admin gets all budget permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.name = 'admin' AND p.module = 'budget'
ON CONFLICT DO NOTHING;

-- Trader gets read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, 'budget.read' FROM roles r WHERE r.name = 'trader'
ON CONFLICT DO NOTHING;

-- Risk manager gets read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, 'budget.read' FROM roles r WHERE r.name = 'risk_manager'
ON CONFLICT DO NOTHING;

-- Operations gets read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, 'budget.read' FROM roles r WHERE r.name = 'operations'
ON CONFLICT DO NOTHING;

-- Viewer gets read only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, 'budget.read' FROM roles r WHERE r.name = 'viewer'
ON CONFLICT DO NOTHING;
