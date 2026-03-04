-- ============================================================================
-- HedgeLab v2 — Migration 008: Org Hierarchy, Customer Profiles & Plugin System
-- ============================================================================
-- Adds:
--   1. customer_profiles — Global templates (consumer / producer)
--   2. org_hierarchy_levels — Defines hierarchy depth per org
--   3. org_units — Recursive tree replacing site_groups
--   4. plugin_registry — Reference table for all plugins with nav metadata
--   5. org_plugins — Per-org plugin enablement
--   6. ALTER sites, organizations, site_groups
--   7. Seed data migration from site_groups → org_units
--   8. Helper functions for hierarchy traversal
--   9. New permissions
-- ============================================================================

BEGIN;

-- ─── 1. Customer Profiles ─────────────────────────────────────────────────

CREATE TABLE customer_profiles (
  id                VARCHAR(50) PRIMARY KEY,
  display_name      VARCHAR(100) NOT NULL,
  operating_model   VARCHAR(20) NOT NULL CHECK (operating_model IN ('budget', 'margin')),
  default_plugins   TEXT[] NOT NULL DEFAULT '{}',
  hierarchy_template JSONB NOT NULL DEFAULT '[]',
  default_site_types TEXT[] NOT NULL DEFAULT '{}',
  default_settings  JSONB NOT NULL DEFAULT '{}',
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO customer_profiles (id, display_name, operating_model, default_plugins, hierarchy_template, default_site_types, default_settings, description)
VALUES
  ('consumer', 'Consumer / End User', 'budget',
   '{"position_manager","trade_capture","budget","market_data","ai_import","forecast"}',
   '[{"depth":0,"label":"Corporate"},{"depth":1,"label":"Country"},{"depth":2,"label":"Region"},{"depth":3,"label":"Site","is_site_level":true}]',
   '{"grain_elevator","feed_yard"}',
   '{"coverage_tracking":true,"budget_approval_workflow":true}',
   'Budget-driven organizations that consume commodities (feed yards, grain elevators, food processors). Multi-site with hierarchical org structure.'),

  ('producer', 'Producer / Margin Trader', 'margin',
   '{"position_manager","trade_capture","market_data","ai_import"}',
   '[{"depth":0,"label":"Organization"},{"depth":1,"label":"Site","is_site_level":true}]',
   '{"trading_desk"}',
   '{"mtm_dashboard":true,"pnl_tracking":true}',
   'Margin-driven organizations focused on trading P&L (trading desks, producers, merchandisers). Flat org structure.');

-- ─── 2. Org Hierarchy Levels ──────────────────────────────────────────────

CREATE TABLE org_hierarchy_levels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id),
  level_depth   INT NOT NULL,
  label         VARCHAR(100) NOT NULL,
  is_site_level BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, level_depth)
);

CREATE INDEX idx_ohl_org ON org_hierarchy_levels(org_id);

-- ─── 3. Org Units (recursive tree) ───────────────────────────────────────

CREATE TABLE org_units (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES organizations(id),
  hierarchy_level_id  UUID NOT NULL REFERENCES org_hierarchy_levels(id),
  parent_id           UUID REFERENCES org_units(id),
  name                VARCHAR(200) NOT NULL,
  code                VARCHAR(20),
  sort_order          INT DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ou_org ON org_units(org_id);
CREATE INDEX idx_ou_parent ON org_units(parent_id);
CREATE INDEX idx_ou_level ON org_units(hierarchy_level_id);

-- ─── 4. Plugin Registry ──────────────────────────────────────────────────

CREATE TABLE plugin_registry (
  id            VARCHAR(50) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  module_prefix VARCHAR(10),
  depends_on    TEXT[] NOT NULL DEFAULT '{}',
  nav_section   VARCHAR(50),
  nav_label     VARCHAR(50),
  nav_href      VARCHAR(100),
  nav_icon      TEXT,
  sort_order    INT DEFAULT 0,
  description   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plugin_registry (id, name, module_prefix, depends_on, nav_section, nav_label, nav_href, sort_order, description) VALUES
  ('position_manager', 'Position Manager', 'pm', '{}', 'Execution', 'Hedge Book', '/hedge-book', 10, 'Hedge book, allocations, EFP, offset, rollover'),
  ('trade_capture', 'Trade Capture', 'tc', '{}', 'Execution', 'Trades', '/trades', 5, 'Trade entry, blotter, matching'),
  ('budget', 'Budget & Forecast', 'bgt', '{}', 'Planning', 'Budget & Forecast', '/budget', 20, 'Budget periods, line items, approval workflow'),
  ('market_data', 'Market Data', 'md', '{}', 'Market', 'Market Data', '/market', 50, 'Price entry, settlement prices, curves'),
  ('formula_pricing', 'Formula Pricing', 'fp', '{"market_data"}', 'Planning', 'Formulas', '/formulas', 25, 'Pricing formulas, rate tables, evaluation'),
  ('ai_import', 'AI Import', NULL, '{}', NULL, NULL, NULL, 0, 'AI-powered data import engine'),
  ('risk', 'Risk Management', 'rsk', '{"position_manager","market_data"}', 'Market', 'Risk', '/risk', 55, 'MTM, position limits, VaR'),
  ('forecast', 'Forecasting', 'fct', '{"budget","market_data"}', 'Planning', 'Forecast', '/forecast', 30, 'Scenarios, sensitivity, stress tests'),
  ('contracts', 'Contracts', 'ct', '{}', 'Planning', 'Contracts', '/contracts', 22, 'Physical contracts, counterparties'),
  ('logistics', 'Logistics', 'lg', '{"contracts"}', 'Operations', 'Logistics', '/logistics', 40, 'Deliveries, inventory, shipping'),
  ('settlement', 'Settlement', 'stl', '{"contracts"}', 'Operations', 'Settlement', '/settlement', 45, 'Invoicing, payments, reconciliation'),
  ('energy', 'Energy', 'nrg', '{"market_data"}', 'Operations', 'Energy', '/energy', 60, 'Energy commodities, load profiles, ISO pricing');

-- ─── 5. Org Plugins (per-org enablement) ─────────────────────────────────

CREATE TABLE org_plugins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES organizations(id),
  plugin_id  VARCHAR(50) NOT NULL REFERENCES plugin_registry(id),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config     JSONB DEFAULT '{}',
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  enabled_by UUID,
  UNIQUE(org_id, plugin_id)
);

CREATE INDEX idx_op_org ON org_plugins(org_id);

-- ─── 6. ALTER Existing Tables ────────────────────────────────────────────

ALTER TABLE sites ADD COLUMN org_unit_id UUID REFERENCES org_units(id);

ALTER TABLE organizations ADD COLUMN customer_profile_id VARCHAR(50) REFERENCES customer_profiles(id);

ALTER TABLE site_groups ADD COLUMN deprecated BOOLEAN DEFAULT false;

-- ─── 7. Migrate Seed Data ────────────────────────────────────────────────

-- Create hierarchy levels for demo org (Country → Site, 2-level for simplicity)
INSERT INTO org_hierarchy_levels (id, org_id, level_depth, label, is_site_level) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 0, 'Country', false),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 1, 'Site', true);

-- Create org_units from existing site_groups ("Canada", "US")
INSERT INTO org_units (id, org_id, hierarchy_level_id, parent_id, name, code, sort_order) VALUES
  ('00000000-0000-0000-0000-000000000400', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000301', NULL, 'Canada', 'CA', 1),
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000301', NULL, 'US', 'US', 2);

-- Update sites with org_unit_id matching their current region
UPDATE sites SET org_unit_id = '00000000-0000-0000-0000-000000000400'
WHERE org_id = '00000000-0000-0000-0000-000000000001' AND region = 'Canada';

UPDATE sites SET org_unit_id = '00000000-0000-0000-0000-000000000401'
WHERE org_id = '00000000-0000-0000-0000-000000000001' AND region = 'US';

-- Mark site_groups as deprecated
UPDATE site_groups SET deprecated = true
WHERE org_id = '00000000-0000-0000-0000-000000000001';

-- Enable plugins for demo org (consumer profile: 6 plugins)
INSERT INTO org_plugins (org_id, plugin_id, is_enabled) VALUES
  ('00000000-0000-0000-0000-000000000001', 'position_manager', true),
  ('00000000-0000-0000-0000-000000000001', 'trade_capture', true),
  ('00000000-0000-0000-0000-000000000001', 'budget', true),
  ('00000000-0000-0000-0000-000000000001', 'market_data', true),
  ('00000000-0000-0000-0000-000000000001', 'ai_import', true),
  ('00000000-0000-0000-0000-000000000001', 'forecast', true);

-- Set demo org profile to 'consumer'
UPDATE organizations SET customer_profile_id = 'consumer'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- ─── 8. Helper Functions ─────────────────────────────────────────────────

-- Get all descendant org_units (recursive CTE)
CREATE OR REPLACE FUNCTION get_descendant_units(p_unit_id UUID)
RETURNS TABLE(id UUID, name VARCHAR, code VARCHAR, parent_id UUID, hierarchy_level_id UUID, level_depth INT) AS $$
  WITH RECURSIVE descendants AS (
    SELECT ou.id, ou.name, ou.code, ou.parent_id, ou.hierarchy_level_id, ohl.level_depth
    FROM org_units ou
    JOIN org_hierarchy_levels ohl ON ohl.id = ou.hierarchy_level_id
    WHERE ou.id = p_unit_id

    UNION ALL

    SELECT child.id, child.name, child.code, child.parent_id, child.hierarchy_level_id, chl.level_depth
    FROM org_units child
    JOIN org_hierarchy_levels chl ON chl.id = child.hierarchy_level_id
    JOIN descendants d ON child.parent_id = d.id
    WHERE child.is_active = true
  )
  SELECT * FROM descendants;
$$ LANGUAGE sql STABLE;

-- Get all site IDs under an org_unit (leaf sites)
CREATE OR REPLACE FUNCTION get_sites_under_unit(p_unit_id UUID)
RETURNS TABLE(site_id UUID) AS $$
  SELECT s.id AS site_id
  FROM sites s
  WHERE s.org_unit_id IN (
    SELECT d.id FROM get_descendant_units(p_unit_id) d
  )
  AND s.is_active = true;
$$ LANGUAGE sql STABLE;

-- ─── 9. New Permissions ──────────────────────────────────────────────────

INSERT INTO permissions (id, module, action) VALUES
  ('admin.org_hierarchy', 'admin', 'manage'),
  ('admin.org_plugins', 'admin', 'manage');

-- Grant to admin role
INSERT INTO role_permissions (role_id, permission_id) VALUES
  ('admin', 'admin.org_hierarchy'),
  ('admin', 'admin.org_plugins');

COMMIT;
