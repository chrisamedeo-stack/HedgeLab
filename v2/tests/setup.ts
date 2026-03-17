import { query } from '@/lib/db';

// Clean test data before each run
// Use a test org ID that won't conflict with real data
export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000099';
export const TEST_USER_ID = '00000000-0000-0000-0000-000000000099';
export const TEST_SITE_ID = '00000000-0000-0000-0000-000000000099';

export async function cleanTestData() {
  // Delete in reverse dependency order
  await query(`DELETE FROM pm_locked_positions WHERE allocation_id IN
    (SELECT id FROM pm_allocations WHERE org_id = $1)`, [TEST_ORG_ID]);
  await query(`DELETE FROM pm_rollover_costs WHERE rollover_id IN
    (SELECT id FROM pm_rollovers WHERE org_id = $1)`, [TEST_ORG_ID]);
  await query(`DELETE FROM pm_rollover_legs WHERE rollover_id IN
    (SELECT id FROM pm_rollovers WHERE org_id = $1)`, [TEST_ORG_ID]);
  await query(`DELETE FROM pm_rollovers WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM pm_allocations WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM pm_physical_positions WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM bgt_line_items WHERE period_id IN
    (SELECT id FROM bgt_periods WHERE org_id = $1)`, [TEST_ORG_ID]);
  await query(`DELETE FROM bgt_periods WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM ct_physical_contracts WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM tc_financial_trades WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM rsk_mtm_snapshots WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM rsk_limit_checks WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM rsk_position_limits WHERE org_id = $1`, [TEST_ORG_ID]);
  await query(`DELETE FROM ct_counterparties WHERE org_id = $1`, [TEST_ORG_ID]);
}

export async function seedTestOrg() {
  // Ensure test org exists
  await query(`
    INSERT INTO organizations (id, name)
    VALUES ($1, 'Test Org')
    ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID]);

  // Ensure test site exists (site_type_id references site_types table)
  await query(`
    INSERT INTO sites (id, org_id, name, code, site_type_id)
    VALUES ($1, $2, 'Test Site', 'TST', 'grain_elevator')
    ON CONFLICT (id) DO NOTHING`, [TEST_SITE_ID, TEST_ORG_ID]);

  // Ensure required plugins are enabled
  for (const plugin of ['trade_capture', 'position_manager', 'budget', 'contracts', 'risk']) {
    await query(`
      INSERT INTO org_plugins (org_id, plugin_id, is_enabled)
      VALUES ($1, $2, true)
      ON CONFLICT (org_id, plugin_id) DO UPDATE SET is_enabled = true`,
      [TEST_ORG_ID, plugin]);
  }

  // Ensure test user has admin role with all permissions
  await query(`
    INSERT INTO users (id, org_id, email, name, role_id)
    VALUES ($1, $2, 'test@hedgelab.com', 'Test User', 'admin')
    ON CONFLICT (id) DO NOTHING`, [TEST_USER_ID, TEST_ORG_ID]);
}

/**
 * Create a budget period and line items for testing.
 * Uses DELETE+INSERT to avoid unique constraint issues.
 */
export async function seedBudgetPeriod(
  periodId: string,
  opts: { months?: string[]; volume?: number } = {}
) {
  const months = opts.months ?? Array.from({ length: 12 }, (_, i) =>
    `2026-${String(i + 1).padStart(2, '0')}`);
  const volume = opts.volume ?? 10000;

  // Delete any existing budget data for this site+commodity+year combo
  await query(`DELETE FROM bgt_line_items WHERE period_id IN
    (SELECT id FROM bgt_periods WHERE site_id = $1 AND commodity_id = 'CORN' AND budget_year = 2026)`,
    [TEST_SITE_ID]);
  await query(`DELETE FROM bgt_periods WHERE site_id = $1 AND commodity_id = 'CORN' AND budget_year = 2026`,
    [TEST_SITE_ID]);

  await query(`
    INSERT INTO bgt_periods (id, org_id, site_id, commodity_id, budget_year, status)
    VALUES ($1, $2, $3, 'CORN', 2026, 'approved')`,
    [periodId, TEST_ORG_ID, TEST_SITE_ID]);

  for (const month of months) {
    await query(`
      INSERT INTO bgt_line_items (period_id, budget_month, budgeted_volume)
      VALUES ($1, $2, $3)`, [periodId, month, volume]);
  }
}

// Use globalThis to guard across module re-imports
const g = globalThis as unknown as { __hedgelab_listeners_registered?: boolean };

export async function registerEventListeners() {
  if (g.__hedgelab_listeners_registered) return;
  g.__hedgelab_listeners_registered = true;

  // Import and register all event listeners (same as instrumentation.ts)
  // This must be called once before tests that rely on cross-module events
  const { registerBudgetEventListeners } = await import('@/lib/budgetEvents');
  const { registerPositionEventListeners } = await import('@/lib/positionEvents');
  const { registerTradeEventListeners } = await import('@/lib/tradeEvents');

  registerBudgetEventListeners();
  registerPositionEventListeners();
  registerTradeEventListeners();
}
