-- Migration 037: Populate pm_trades and org_nodes from existing data
-- This copies data from old tables into new tables. Old tables remain untouched.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Populate org_nodes from organizations + org_units + sites
-- ═══════════════════════════════════════════════════════════════════

-- Tier 0: Corporate root (from organizations)
INSERT INTO org_nodes (id, org_id, parent_id, tier_level, name, code)
SELECT
  gen_random_uuid(),
  o.id,
  NULL,
  0,
  o.name,
  NULL
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM org_nodes n WHERE n.org_id = o.id AND n.tier_level = 0
)
ON CONFLICT DO NOTHING;

-- Tier 1: Countries/Regions (from org_units)
INSERT INTO org_nodes (id, org_id, parent_id, tier_level, name, code)
SELECT
  ou.id,    -- preserve original UUID for FK mapping
  ou.org_id,
  (SELECT n.id FROM org_nodes n WHERE n.org_id = ou.org_id AND n.tier_level = 0 LIMIT 1),
  1,
  ou.name,
  ou.code
FROM org_units ou
WHERE ou.is_active = true
  AND NOT EXISTS (SELECT 1 FROM org_nodes n WHERE n.id = ou.id)
ON CONFLICT DO NOTHING;

-- Tier 2: Sites (from sites table — leaf nodes)
INSERT INTO org_nodes (id, org_id, parent_id, tier_level, name, code)
SELECT
  s.id,     -- preserve original UUID for FK mapping
  s.org_id,
  s.org_unit_id,  -- parent = org_unit
  2,
  s.name,
  s.code
FROM sites s
WHERE s.is_active = true
  AND s.org_unit_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM org_nodes n WHERE n.id = s.id)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Migrate financial trades (tc_financial_trades → pm_trades)
-- ═══════════════════════════════════════════════════════════════════

-- All existing financial trades are futures (verified by query above)
INSERT INTO pm_trades (
  org_id, trade_ref, trade_date, category, commodity, instrument, direction,
  quantity, contracts, contract_month, trade_price, budget_month,
  strike, put_call, premium, delta,
  is_active, created_at, updated_at, created_by
)
SELECT
  ft.org_id,
  'TRD-' || LPAD(nextval('pm_trade_ref_seq')::TEXT, 4, '0'),
  ft.trade_date,
  'financial',
  ft.commodity_id,
  CASE ft.trade_type
    WHEN 'futures' THEN 'futures'
    WHEN 'options' THEN
      CASE WHEN ft.option_type = 'put' THEN 'put_option' ELSE 'call_option' END
    WHEN 'swap' THEN 'swap_otc'
    ELSE 'futures'
  END,
  ft.direction,
  COALESCE(ft.total_volume, ft.num_contracts * ft.contract_size),
  ft.num_contracts,
  ft.contract_month,
  ft.trade_price,
  CASE WHEN ft.budget_month IS NOT NULL THEN (ft.budget_month || '-01')::DATE ELSE NULL END,
  ft.strike_price,
  CASE WHEN ft.option_type = 'put' THEN 'P' WHEN ft.option_type = 'call' THEN 'C' ELSE NULL END,
  ft.premium,
  NULL,  -- delta not stored in old schema
  (ft.status != 'cancelled'),
  ft.created_at,
  ft.updated_at,
  ft.entered_by
FROM tc_financial_trades ft
ORDER BY ft.created_at;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Migrate physical positions (pm_physical_positions → pm_trades)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO pm_trades (
  org_id, trade_ref, trade_date, category, commodity, instrument, direction,
  quantity, site_id, delivery_location_id,
  basis, board_month, flat_price, is_priced,
  is_active, created_at, updated_at
)
SELECT
  pp.org_id,
  'TRD-' || LPAD(nextval('pm_trade_ref_seq')::TEXT, 4, '0'),
  COALESCE(pp.created_at::date, CURRENT_DATE),
  'physical',
  pp.commodity_id,
  CASE pp.pricing_type
    WHEN 'fixed' THEN 'fixed_price'
    WHEN 'basis' THEN 'basis'
    WHEN 'hta' THEN 'hta'
    ELSE 'fixed_price'
  END,
  pp.direction,
  pp.volume,
  pp.site_id,
  pp.site_id,   -- delivery_location defaults to site
  pp.basis_price,
  pp.basis_month,
  pp.price,
  (pp.pricing_type = 'fixed' AND pp.price IS NOT NULL),
  (pp.status != 'cancelled'),
  pp.created_at,
  pp.updated_at
FROM pm_physical_positions pp
ORDER BY pp.created_at;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Verification queries (run these manually after migration)
-- ═══════════════════════════════════════════════════════════════════
-- SELECT COUNT(*) FROM pm_trades WHERE category = 'financial';
-- -- Should equal: SELECT COUNT(*) FROM tc_financial_trades;
--
-- SELECT COUNT(*) FROM pm_trades WHERE category = 'physical';
-- -- Should equal: SELECT COUNT(*) FROM pm_physical_positions;
--
-- SELECT COUNT(*) FROM org_nodes;
-- -- Should equal: org count + org_units count + sites count
