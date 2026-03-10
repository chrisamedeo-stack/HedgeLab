-- ============================================================================
-- HedgeLab v2 — Migration 018: Setup Wizard (3 new profiles + site types)
-- ============================================================================
-- Adds:
--   1. 3 new customer profiles: merchandiser, utility, cms
--   2. 2 new site types: utility_plant, cms_commercial_site
-- ============================================================================

BEGIN;

-- ─── 1. New Site Types ──────────────────────────────────────────────────

INSERT INTO site_types (id, name, supported_commodities, description)
VALUES
  ('utility_plant', 'Utility Plant',
   '{"POWER","NAT_GAS"}',
   'Utility generation or distribution plant'),
  ('cms_commercial_site', 'Commercial Site',
   '{"CORN","SOYBEAN","WHEAT","POWER","NAT_GAS"}',
   'Contract management commercial site')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. New Customer Profiles ───────────────────────────────────────────

INSERT INTO customer_profiles (id, display_name, operating_model, default_plugins, hierarchy_template, default_site_types, default_settings, description)
VALUES
  ('merchandiser', 'Merchandiser', 'margin',
   '{"position_manager","trade_capture","market_data","ai_import","contracts","logistics","settlement","risk"}',
   '[{"depth":0,"label":"Organization"},{"depth":1,"label":"Desk"},{"depth":2,"label":"Book","is_site_level":true}]',
   '{"trading_desk"}',
   '{"mtm_dashboard":true,"pnl_tracking":true}',
   'Margin-driven trading organizations. Desk/book hierarchy with full trade lifecycle, contracts, logistics, settlement, and risk.'),

  ('utility', 'Utility', 'budget',
   '{"position_manager","trade_capture","budget","market_data","ai_import","forecast","energy"}',
   '[{"depth":0,"label":"Utility"},{"depth":1,"label":"Region"},{"depth":2,"label":"Site","is_site_level":true}]',
   '{"utility_plant"}',
   '{"coverage_tracking":true,"budget_approval_workflow":true,"load_profiles":true}',
   'Budget-driven energy utilities with coverage tracking, forecasting, load profiles, and energy module.'),

  ('cms', 'Contract Management', 'budget',
   '{"position_manager","trade_capture","budget","market_data","ai_import","contracts","settlement","energy","forecast"}',
   '[{"depth":0,"label":"Corporate"},{"depth":1,"label":"Country"},{"depth":2,"label":"Region"},{"depth":3,"label":"Site","is_site_level":true}]',
   '{"cms_commercial_site"}',
   '{"coverage_tracking":true,"budget_approval_workflow":true,"contract_management":true}',
   'Full contract management with multi-level hierarchy, budget approval workflow, energy, and settlement.')
ON CONFLICT (id) DO NOTHING;

COMMIT;
