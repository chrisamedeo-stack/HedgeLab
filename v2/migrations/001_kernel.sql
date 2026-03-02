-- ============================================================================
-- HedgeLab v2 — Kernel Migration
-- ============================================================================
-- Creates all kernel tables: commodities, contract calendar, organizations,
-- users, RBAC, audit, FX, sites, site types, site groups, event bus,
-- custom fields, import engine, pricing engine, dashboards.
-- ============================================================================

BEGIN;

-- ─── 1. Commodity Registry ──────────────────────────────────────────────────

CREATE TABLE commodities (
  id              VARCHAR(20) PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  category        VARCHAR(20) NOT NULL DEFAULT 'ag',
  unit            VARCHAR(20) NOT NULL,
  currency        VARCHAR(3) DEFAULT 'USD',
  contract_size   NUMERIC,
  tick_size       NUMERIC,
  tick_value       NUMERIC,
  exchange        VARCHAR(20),
  contract_months VARCHAR(24),
  decimal_places  INT DEFAULT 2,
  is_active       BOOLEAN DEFAULT true,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO commodities (id, name, category, unit, contract_size, tick_size, tick_value, exchange, contract_months)
VALUES
  ('CORN', 'Corn', 'ag', 'bushels', 5000, 0.25, 12.50, 'CBOT', 'HKNUZ'),
  ('SOYBEAN', 'Soybeans', 'ag', 'bushels', 5000, 0.25, 12.50, 'CBOT', 'FHKNQUX'),
  ('WHEAT', 'Wheat (SRW)', 'ag', 'bushels', 5000, 0.25, 12.50, 'CBOT', 'HKNUZ'),
  ('SOYOIL', 'Soybean Oil', 'ag', 'pounds', 60000, 0.01, 6.00, 'CBOT', 'FHKNQUVZ'),
  ('SOYMEAL', 'Soybean Meal', 'ag', 'short tons', 100, 0.10, 10.00, 'CBOT', 'FHKNQUVZ');

-- ─── 2. Contract Calendar ───────────────────────────────────────────────────

CREATE TABLE commodity_contract_calendar (
  id                  BIGSERIAL PRIMARY KEY,
  commodity_id        VARCHAR(20) NOT NULL REFERENCES commodities(id),
  contract_month      VARCHAR(10) NOT NULL,
  first_notice_date   DATE,
  last_trade_date     DATE,
  expiration_date     DATE,
  first_delivery_date DATE,
  last_delivery_date  DATE,
  is_active           BOOLEAN DEFAULT true,
  source              VARCHAR(50) DEFAULT 'manual',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(commodity_id, contract_month)
);

CREATE INDEX idx_cal_commodity ON commodity_contract_calendar(commodity_id, contract_month);
CREATE INDEX idx_cal_expiry ON commodity_contract_calendar(last_trade_date);

CREATE OR REPLACE FUNCTION get_contract_deadlines(p_commodity VARCHAR, p_month VARCHAR)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'first_notice_date', first_notice_date,
    'last_trade_date', last_trade_date,
    'expiration_date', expiration_date,
    'days_to_first_notice', first_notice_date - CURRENT_DATE,
    'days_to_last_trade', last_trade_date - CURRENT_DATE,
    'is_expired', expiration_date < CURRENT_DATE,
    'needs_attention', first_notice_date - CURRENT_DATE <= 14
  )
  FROM commodity_contract_calendar
  WHERE commodity_id = p_commodity AND contract_month = p_month;
$$ LANGUAGE sql STABLE;

-- ─── 3. Organizations ───────────────────────────────────────────────────────

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  base_currency   VARCHAR(3) DEFAULT 'USD',
  settings        JSONB DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE org_settings (
  org_id                      UUID PRIMARY KEY,
  default_currency            VARCHAR(3) DEFAULT 'USD',
  reporting_currency          VARCHAR(3) DEFAULT 'USD',
  fiscal_year_start           INT DEFAULT 1,
  date_format                 VARCHAR(20) DEFAULT 'MM/DD/YYYY',
  number_format               VARCHAR(20) DEFAULT '1,000.00',
  timezone                    VARCHAR(50) DEFAULT 'America/Chicago',
  default_exchange            VARCHAR(20) DEFAULT 'CBOT',
  default_broker              VARCHAR(200),
  default_account             VARCHAR(50),
  commission_default          NUMERIC DEFAULT 0,
  budget_lock_after_approval  BOOLEAN DEFAULT false,
  budget_variance_threshold   NUMERIC DEFAULT 10,
  mtm_auto_run                BOOLEAN DEFAULT true,
  mtm_run_time                TIME DEFAULT '16:30',
  position_limit_hard_block   BOOLEAN DEFAULT false,
  import_require_approval     BOOLEAN DEFAULT true,
  import_auto_template        BOOLEAN DEFAULT true,
  notifications_enabled       BOOLEAN DEFAULT true,
  email_notifications         BOOLEAN DEFAULT true,
  roll_critical_days          INT DEFAULT 3,
  roll_urgent_days            INT DEFAULT 7,
  roll_upcoming_days          INT DEFAULT 21,
  roll_auto_notify            BOOLEAN DEFAULT true,
  roll_require_approval_critical BOOLEAN DEFAULT true,
  roll_default_target         VARCHAR(20) DEFAULT 'next_active',
  roll_budget_month_policy    VARCHAR(20) DEFAULT 'keep_original',
  roll_cost_allocation        VARCHAR(20) DEFAULT 'site',
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 4. Users & RBAC ────────────────────────────────────────────────────────

CREATE TABLE roles (
  id          VARCHAR(50) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_system   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id),
  email       VARCHAR(255) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  role_id     VARCHAR(50) NOT NULL DEFAULT 'viewer' REFERENCES roles(id),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
  id          VARCHAR(100) PRIMARY KEY,
  module      VARCHAR(30) NOT NULL,
  action      VARCHAR(30) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id       VARCHAR(50) REFERENCES roles(id),
  permission_id VARCHAR(100) REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_permission_overrides (
  user_id       UUID NOT NULL,
  permission_id VARCHAR(100) REFERENCES permissions(id),
  granted       BOOLEAN NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);

-- Seed roles
INSERT INTO roles (id, name, is_system) VALUES
  ('admin', 'Administrator', true),
  ('trader', 'Trader', true),
  ('risk_manager', 'Risk Manager', true),
  ('operations', 'Operations', true),
  ('viewer', 'Viewer', true);

-- Seed ALL permissions (every plugin)
INSERT INTO permissions (id, module, action) VALUES
  ('trade.create', 'trade', 'create'), ('trade.read', 'trade', 'read'),
  ('trade.update', 'trade', 'update'), ('trade.cancel', 'trade', 'cancel'),
  ('trade.import', 'trade', 'import'),
  ('position.read', 'position', 'read'), ('position.allocate', 'position', 'allocate'),
  ('position.efp', 'position', 'efp'), ('position.offset', 'position', 'offset'),
  ('position.create_physical', 'position', 'create'),
  ('position.roll', 'position', 'roll'), ('position.roll_approve', 'position', 'approve'),
  ('position.roll_cancel', 'position', 'cancel'),
  ('budget.read', 'budget', 'read'), ('budget.create', 'budget', 'create'),
  ('budget.update', 'budget', 'update'), ('budget.submit', 'budget', 'submit'),
  ('budget.approve', 'budget', 'approve'), ('budget.lock', 'budget', 'lock'),
  ('budget.unlock', 'budget', 'unlock'), ('budget.compare', 'budget', 'read'),
  ('risk.read', 'risk', 'read'), ('risk.run_mtm', 'risk', 'execute'),
  ('risk.set_limits', 'risk', 'update'),
  ('market.read', 'market', 'read'), ('market.enter_price', 'market', 'create'),
  ('contract.create', 'contract', 'create'), ('contract.read', 'contract', 'read'),
  ('contract.update', 'contract', 'update'), ('contract.cancel', 'contract', 'cancel'),
  ('logistics.read', 'logistics', 'read'), ('logistics.record_delivery', 'logistics', 'create'),
  ('settlement.read', 'settlement', 'read'), ('settlement.create_invoice', 'settlement', 'create'),
  ('settlement.record_payment', 'settlement', 'update'),
  ('admin.users', 'admin', 'manage'), ('admin.sites', 'admin', 'manage'),
  ('admin.commodities', 'admin', 'manage'), ('admin.roles', 'admin', 'manage'),
  ('admin.org_settings', 'admin', 'manage'), ('admin.site_groups', 'admin', 'manage'),
  ('admin.custom_fields', 'admin', 'manage'), ('admin.import_templates', 'admin', 'manage'),
  ('import.upload', 'import', 'create'), ('import.approve', 'import', 'approve'),
  ('import.reject', 'import', 'delete'),
  ('pricing.read', 'pricing', 'read'), ('pricing.create_formula', 'pricing', 'create'),
  ('pricing.edit_formula', 'pricing', 'update'), ('pricing.manage_rates', 'pricing', 'manage'),
  ('forecast.read', 'forecast', 'read'), ('forecast.create_scenario', 'forecast', 'create'),
  ('forecast.run', 'forecast', 'execute'), ('forecast.stress_test', 'forecast', 'execute'),
  ('dashboard.read', 'dashboard', 'read'), ('dashboard.configure', 'dashboard', 'update'),
  ('dashboard.export', 'dashboard', 'export');

-- Admin gets everything
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'admin', id FROM permissions;

-- Trader
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('trader', 'trade.create'), ('trader', 'trade.read'), ('trader', 'trade.update'),
  ('trader', 'trade.import'),
  ('trader', 'position.read'), ('trader', 'position.allocate'),
  ('trader', 'position.efp'), ('trader', 'position.offset'),
  ('trader', 'position.create_physical'), ('trader', 'position.roll'),
  ('trader', 'market.read'), ('trader', 'market.enter_price'),
  ('trader', 'budget.read'), ('trader', 'contract.read'),
  ('trader', 'pricing.read'), ('trader', 'forecast.read'),
  ('trader', 'forecast.create_scenario'), ('trader', 'forecast.run'),
  ('trader', 'dashboard.read'), ('trader', 'dashboard.configure'),
  ('trader', 'import.upload');

-- Risk Manager
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('risk_manager', 'trade.read'), ('risk_manager', 'position.read'),
  ('risk_manager', 'position.roll_approve'),
  ('risk_manager', 'risk.read'), ('risk_manager', 'risk.run_mtm'),
  ('risk_manager', 'risk.set_limits'),
  ('risk_manager', 'market.read'), ('risk_manager', 'budget.read'),
  ('risk_manager', 'contract.read'), ('risk_manager', 'pricing.read'),
  ('risk_manager', 'forecast.read'), ('risk_manager', 'forecast.run'),
  ('risk_manager', 'forecast.stress_test'),
  ('risk_manager', 'dashboard.read'), ('risk_manager', 'dashboard.configure'),
  ('risk_manager', 'import.approve'), ('risk_manager', 'import.reject');

-- Operations
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('operations', 'trade.read'), ('operations', 'position.read'),
  ('operations', 'contract.read'), ('operations', 'contract.create'),
  ('operations', 'contract.update'),
  ('operations', 'logistics.read'), ('operations', 'logistics.record_delivery'),
  ('operations', 'settlement.read'), ('operations', 'settlement.create_invoice'),
  ('operations', 'settlement.record_payment'),
  ('operations', 'budget.read'), ('operations', 'dashboard.read'),
  ('operations', 'import.upload');

-- Viewer gets read-only
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 'viewer', id FROM permissions WHERE action = 'read';

-- ─── 5. Audit System ────────────────────────────────────────────────────────

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  org_id          UUID,
  user_id         UUID,
  module          VARCHAR(30) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       VARCHAR(100) NOT NULL,
  action          VARCHAR(20) NOT NULL,
  changes         JSONB NOT NULL DEFAULT '{}',
  before_snapshot JSONB,
  after_snapshot  JSONB,
  ip_address      INET,
  user_agent      VARCHAR(500),
  source          VARCHAR(30) DEFAULT 'ui',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_module ON audit_log(module, created_at DESC);

-- ─── 6. FX Rates ────────────────────────────────────────────────────────────

CREATE TABLE fx_rates (
  id            BIGSERIAL PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency   VARCHAR(3) NOT NULL,
  rate_date     DATE NOT NULL,
  rate          NUMERIC(12,6) NOT NULL,
  source        VARCHAR(50) DEFAULT 'manual',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, rate_date)
);

CREATE INDEX idx_fx_lookup ON fx_rates(from_currency, to_currency, rate_date DESC);

CREATE OR REPLACE FUNCTION convert_currency(
  p_amount NUMERIC, p_from VARCHAR, p_to VARCHAR, p_date DATE DEFAULT CURRENT_DATE
) RETURNS JSONB AS $$
DECLARE v_rate NUMERIC; v_rate_date DATE;
BEGIN
  IF p_from = p_to THEN
    RETURN jsonb_build_object('amount', p_amount, 'rate', 1, 'rate_date', p_date, 'is_stale', false);
  END IF;
  SELECT rate, rate_date INTO v_rate, v_rate_date FROM fx_rates
    WHERE from_currency = p_from AND to_currency = p_to AND rate_date <= p_date
    ORDER BY rate_date DESC LIMIT 1;
  IF v_rate IS NULL THEN
    SELECT 1.0/rate, rate_date INTO v_rate, v_rate_date FROM fx_rates
      WHERE from_currency = p_to AND to_currency = p_from AND rate_date <= p_date
      ORDER BY rate_date DESC LIMIT 1;
  END IF;
  IF v_rate IS NULL THEN
    RETURN jsonb_build_object('amount', null, 'rate', null, 'error', 'No FX rate available');
  END IF;
  RETURN jsonb_build_object(
    'amount', ROUND(p_amount * v_rate, 2),
    'rate', v_rate,
    'rate_date', v_rate_date,
    'is_stale', (p_date - v_rate_date) > 3
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- ─── 7. Site Types & Sites ──────────────────────────────────────────────────

CREATE TABLE site_types (
  id                    VARCHAR(50) PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  operating_model       VARCHAR(20) NOT NULL,
  supported_commodities TEXT[] NOT NULL,
  features              JSONB NOT NULL DEFAULT '{}',
  position_sections     TEXT[] DEFAULT '{}',
  kpi_config            JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_types (id, name, operating_model, supported_commodities, features, position_sections)
VALUES
  ('grain_elevator', 'Grain Elevator', 'budget',
   '{"CORN","SOYBEAN","WHEAT"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":true,"offsetWorkflow":true,"rolloverWorkflow":true,"budgetMonths":true,"coverageChart":true,"mtmDashboard":false}',
   '{"hedges","physicals","locked","open_board","all_in_summary"}'),
  ('feed_yard', 'Feed Yard', 'budget',
   '{"CORN","SOYBEAN"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":true,"offsetWorkflow":true,"rolloverWorkflow":true,"budgetMonths":true,"coverageChart":true,"mtmDashboard":false}',
   '{"hedges","physicals","locked","all_in_summary"}'),
  ('trading_desk', 'Trading Desk', 'margin',
   '{"CORN","SOYBEAN","WHEAT","SOYOIL","SOYMEAL"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":true,"offsetWorkflow":true,"rolloverWorkflow":true,"budgetMonths":false,"coverageChart":false,"mtmDashboard":true}',
   '{"hedges","physicals","locked","open_board","pnl_summary"}'),
  ('energy_retail', 'Energy Retail', 'margin',
   '{"POWER","NAT_GAS"}',
   '{"hedgeBook":true,"physicalCommitments":true,"efpWorkflow":false,"offsetWorkflow":true,"rolloverWorkflow":false,"budgetMonths":false,"coverageChart":false,"mtmDashboard":true,"loadProfiles":true}',
   '{"hedges","supply_contracts","load_profile","pnl_summary"}');

CREATE TABLE sites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id),
  site_type_id VARCHAR(50) NOT NULL REFERENCES site_types(id),
  name         VARCHAR(200) NOT NULL,
  code         VARCHAR(20),
  region       VARCHAR(50) NOT NULL,
  timezone     VARCHAR(50) DEFAULT 'America/Chicago',
  is_active    BOOLEAN DEFAULT true,
  config       JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id),
  name       VARCHAR(200) NOT NULL,
  group_type VARCHAR(30) NOT NULL,
  parent_id  UUID REFERENCES site_groups(id),
  sort_order INT DEFAULT 0,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE site_group_members (
  site_group_id UUID NOT NULL REFERENCES site_groups(id),
  site_id       UUID NOT NULL REFERENCES sites(id),
  PRIMARY KEY (site_group_id, site_id)
);

CREATE TABLE commodity_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  name          VARCHAR(100) NOT NULL,
  commodity_ids TEXT[] NOT NULL,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. Event Bus ────────────────────────────────────────────────────────────

CREATE TABLE event_log (
  id            BIGSERIAL PRIMARY KEY,
  event_type    VARCHAR(50) NOT NULL,
  source_module VARCHAR(30) NOT NULL,
  entity_type   VARCHAR(50),
  entity_id     VARCHAR(100),
  payload       JSONB NOT NULL DEFAULT '{}',
  org_id        UUID,
  user_id       UUID,
  processed_by  TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_type ON event_log(event_type, created_at DESC);

-- ─── 9. Custom Fields & Saved Views ─────────────────────────────────────────

CREATE TABLE custom_field_definitions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  entity_type   VARCHAR(50) NOT NULL,
  field_name    VARCHAR(50) NOT NULL,
  field_label   VARCHAR(100) NOT NULL,
  field_type    VARCHAR(20) NOT NULL,
  options       JSONB,
  is_required   BOOLEAN DEFAULT false,
  default_value TEXT,
  sort_order    INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, entity_type, field_name)
);

CREATE TABLE custom_field_values (
  id           BIGSERIAL PRIMARY KEY,
  field_def_id UUID NOT NULL REFERENCES custom_field_definitions(id),
  entity_type  VARCHAR(50) NOT NULL,
  entity_id    UUID NOT NULL,
  value        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_def_id, entity_id)
);

CREATE TABLE user_saved_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  view_name  VARCHAR(200) NOT NULL,
  view_type  VARCHAR(50) NOT NULL,
  config     JSONB NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. AI Import Engine ────────────────────────────────────────────────────

CREATE TABLE import_jobs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id),
  user_id           UUID NOT NULL,
  target_module     VARCHAR(30) NOT NULL,
  target_table      VARCHAR(50) NOT NULL,
  file_name         VARCHAR(500) NOT NULL,
  file_type         VARCHAR(20) NOT NULL,
  file_size         BIGINT,
  file_path         VARCHAR(500),
  status            VARCHAR(20) NOT NULL DEFAULT 'uploaded',
  ai_model          VARCHAR(50),
  ai_prompt_used    TEXT,
  ai_raw_response   TEXT,
  total_rows        INT DEFAULT 0,
  valid_rows        INT DEFAULT 0,
  error_rows        INT DEFAULT 0,
  warning_rows      INT DEFAULT 0,
  column_mapping    JSONB DEFAULT '{}',
  validation_summary JSONB DEFAULT '{}',
  reviewed_by       UUID,
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE import_staged_rows (
  id              BIGSERIAL PRIMARY KEY,
  job_id          UUID NOT NULL REFERENCES import_jobs(id),
  row_number      INT NOT NULL,
  raw_data        JSONB NOT NULL,
  mapped_data     JSONB NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending',
  errors          JSONB DEFAULT '[]',
  warnings        JSONB DEFAULT '[]',
  ai_corrections  JSONB DEFAULT '{}',
  user_overrides  JSONB DEFAULT '{}',
  final_data      JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staged_job ON import_staged_rows(job_id, row_number);

CREATE TABLE import_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL REFERENCES organizations(id),
  name              VARCHAR(200) NOT NULL,
  target_module     VARCHAR(30) NOT NULL,
  target_table      VARCHAR(50) NOT NULL,
  column_mapping    JSONB NOT NULL,
  transforms        JSONB DEFAULT '{}',
  custom_rules      JSONB DEFAULT '[]',
  source_description TEXT,
  sample_headers    TEXT[],
  created_by        UUID,
  use_count         INT DEFAULT 0,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 11. Formula Pricing Engine ──────────────────────────────────────────────

CREATE TABLE pricing_formulas (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES organizations(id),
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  commodity_id VARCHAR(20) REFERENCES commodities(id),
  formula_type VARCHAR(30) NOT NULL,
  components   JSONB NOT NULL,
  output_unit  VARCHAR(20),
  rounding     INT DEFAULT 4,
  is_active    BOOLEAN DEFAULT true,
  is_system    BOOLEAN DEFAULT false,
  created_by   UUID,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_rate_tables (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID NOT NULL REFERENCES organizations(id),
  name           VARCHAR(200) NOT NULL,
  rate_type      VARCHAR(30) NOT NULL,
  commodity_id   VARCHAR(20) REFERENCES commodities(id),
  rates          JSONB NOT NULL,
  effective_date DATE,
  expiry_date    DATE,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pricing_applied (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id       UUID REFERENCES pricing_formulas(id),
  entity_type      VARCHAR(50) NOT NULL,
  entity_id        UUID NOT NULL,
  component_values JSONB NOT NULL,
  total_price      NUMERIC NOT NULL,
  currency         VARCHAR(3) DEFAULT 'USD',
  applied_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  applied_by       UUID,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pricing_applied_entity ON pricing_applied(entity_type, entity_id);

-- ─── 12. Dashboard Config ────────────────────────────────────────────────────

CREATE TABLE crt_dashboards (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  org_id     UUID NOT NULL REFERENCES organizations(id),
  name       VARCHAR(200) DEFAULT 'My Dashboard',
  layout     JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 13. Kernel Helper Functions ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_commodity(p_id VARCHAR) RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'id', id, 'name', name, 'category', category, 'unit', unit,
    'currency', currency, 'contract_size', contract_size, 'exchange', exchange,
    'contract_months', contract_months, 'decimal_places', decimal_places
  ) FROM commodities WHERE id = p_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION site_supports_commodity(p_site_id UUID, p_commodity_id VARCHAR) RETURNS BOOLEAN AS $$
  SELECT p_commodity_id = ANY(st.supported_commodities)
  FROM sites s JOIN site_types st ON st.id = s.site_type_id
  WHERE s.id = p_site_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_operating_model(p_site_id UUID) RETURNS VARCHAR AS $$
  SELECT st.operating_model
  FROM sites s JOIN site_types st ON st.id = s.site_type_id
  WHERE s.id = p_site_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_site_features(p_site_id UUID) RETURNS JSONB AS $$
  SELECT st.features
  FROM sites s JOIN site_types st ON st.id = s.site_type_id
  WHERE s.id = p_site_id;
$$ LANGUAGE sql STABLE;

-- ─── 14. Seed Data ───────────────────────────────────────────────────────────

-- Default organization
INSERT INTO organizations (id, name, base_currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'HedgeLab Demo', 'USD');

INSERT INTO org_settings (org_id) VALUES ('00000000-0000-0000-0000-000000000001');

-- Default admin user
INSERT INTO users (id, org_id, email, name, role_id)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'admin@hedgelab.com',
  'System Admin',
  'admin'
);

-- Example site groups (regions)
INSERT INTO site_groups (id, org_id, name, group_type, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', 'Canada', 'region', 1),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'US', 'region', 2);

-- Example sites
INSERT INTO sites (id, org_id, site_type_id, name, code, region) VALUES
  ('00000000-0000-0000-0000-000000000200', '00000000-0000-0000-0000-000000000001', 'grain_elevator', 'Lethbridge Elevator', 'LETH', 'Canada'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'grain_elevator', 'Brooks Elevator', 'BRKS', 'Canada'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'feed_yard', 'Fargo Feed Yard', 'FARG', 'US');

-- Link sites to site groups
INSERT INTO site_group_members (site_group_id, site_id) VALUES
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000200'),
  ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000202');

-- Example FX rate
INSERT INTO fx_rates (from_currency, to_currency, rate_date, rate, source)
VALUES ('USD', 'CAD', CURRENT_DATE, 1.3650, 'seed');

COMMIT;
