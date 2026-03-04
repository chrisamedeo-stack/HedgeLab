-- ============================================================================
-- HedgeLab v2 — Migration 009: Formula Pricing Integration & Cleanup
-- ============================================================================
-- 1. Simplify site_types — drop feature-gating columns (now at org plugin level)
-- 2. Update + add broader commercial site types
-- 3. Add Hybrid customer profile
-- 4. Add formula columns to pm_physical_positions and bgt_line_items
-- 5. Enable formula_pricing plugin for demo org
-- ============================================================================

BEGIN;

-- ─── 1. Simplify site_types ────────────────────────────────────────────────

ALTER TABLE site_types DROP COLUMN IF EXISTS operating_model;
ALTER TABLE site_types DROP COLUMN IF EXISTS features;
ALTER TABLE site_types DROP COLUMN IF EXISTS position_sections;
ALTER TABLE site_types DROP COLUMN IF EXISTS kpi_config;
ALTER TABLE site_types ADD COLUMN IF NOT EXISTS description TEXT;

-- ─── 2. Update existing + add new site types ───────────────────────────────

UPDATE site_types SET description = 'Grain storage, receiving, and shipping facility' WHERE id = 'grain_elevator';
UPDATE site_types SET description = 'Livestock feeding operation with commodity consumption' WHERE id = 'feed_yard';
UPDATE site_types SET description = 'Commodity processing and transformation facility' WHERE id = 'processing';
UPDATE site_types SET description = 'Commodity trading and risk management desk' WHERE id = 'trading_desk';

INSERT INTO site_types (id, name, supported_commodities, description) VALUES
  ('manufacturing_plant', 'Manufacturing Plant', '{}', 'Industrial manufacturing using raw commodity inputs'),
  ('processing_facility', 'Processing Facility', '{}', 'Commodity processing (crushing, refining, milling)'),
  ('distribution_center', 'Distribution Center', '{}', 'Regional distribution and logistics hub'),
  ('terminal', 'Terminal', '{}', 'Port or inland terminal for commodity transfer'),
  ('warehouse', 'Warehouse', '{}', 'Commodity storage and inventory facility')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ─── 3. Add Hybrid customer profile ────────────────────────────────────────

-- Expand the CHECK constraint on operating_model
ALTER TABLE customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_operating_model_check;
ALTER TABLE customer_profiles ADD CONSTRAINT customer_profiles_operating_model_check
  CHECK (operating_model IN ('budget', 'margin', 'hybrid'));

INSERT INTO customer_profiles (id, display_name, operating_model, default_plugins, hierarchy_template, default_site_types, default_settings, description)
VALUES
  ('hybrid', 'Hybrid (Budget + P&L)', 'hybrid',
   '{"position_manager","trade_capture","budget","market_data","ai_import","forecast","formula_pricing"}',
   '[{"depth":0,"label":"Corporate"},{"depth":1,"label":"Division"},{"depth":2,"label":"Region"},{"depth":3,"label":"Site","is_site_level":true}]',
   '{"manufacturing_plant","processing_facility","distribution_center","terminal"}',
   '{"coverage_tracking":true,"budget_approval_workflow":true,"mtm_dashboard":true,"pnl_tracking":true}',
   'Hybrid organizations using both budget management and P&L tracking (large processors, diversified agribusiness). Supports formula pricing and multi-level hierarchy.')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  operating_model = EXCLUDED.operating_model,
  default_plugins = EXCLUDED.default_plugins,
  description = EXCLUDED.description;

-- ─── 4. Add formula columns to physical positions and budget line items ────

ALTER TABLE pm_physical_positions ADD COLUMN IF NOT EXISTS formula_id UUID;
ALTER TABLE pm_physical_positions ADD COLUMN IF NOT EXISTS formula_inputs JSONB;
ALTER TABLE pm_physical_positions ADD COLUMN IF NOT EXISTS formula_result JSONB;

ALTER TABLE bgt_line_items ADD COLUMN IF NOT EXISTS formula_id UUID;
ALTER TABLE bgt_line_items ADD COLUMN IF NOT EXISTS formula_inputs JSONB;
ALTER TABLE bgt_line_items ADD COLUMN IF NOT EXISTS formula_price NUMERIC;

-- ─── 5. Enable formula_pricing plugin for demo org ─────────────────────────

INSERT INTO org_plugins (org_id, plugin_id, is_enabled)
VALUES ('00000000-0000-0000-0000-000000000001', 'formula_pricing', true)
ON CONFLICT (org_id, plugin_id) DO UPDATE SET is_enabled = true;

COMMIT;
