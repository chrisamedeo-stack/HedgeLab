import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, TEST_ORG_ID } from '../setup';
import { query, queryOne } from '@/lib/db';

describe('Settings: Org Settings', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
  });
  afterAll(async () => { await cleanTestData(); });

  it('should update organization name', async () => {
    await query(`
      UPDATE organizations SET name = 'StoneX Financial Inc'
      WHERE id = $1`, [TEST_ORG_ID]);

    const org = await queryOne<{ name: string }>(
      `SELECT name FROM organizations WHERE id = $1`, [TEST_ORG_ID]);
    expect(org?.name).toBe('StoneX Financial Inc');

    // Restore
    await query(`UPDATE organizations SET name = 'Test Org' WHERE id = $1`, [TEST_ORG_ID]);
  });

  it('should create org settings with defaults', async () => {
    await query(`
      INSERT INTO org_settings (org_id)
      VALUES ($1)
      ON CONFLICT (org_id) DO NOTHING`, [TEST_ORG_ID]);

    const settings = await queryOne<{ default_currency: string; fiscal_year_start: number }>(
      `SELECT default_currency, fiscal_year_start FROM org_settings WHERE org_id = $1`,
      [TEST_ORG_ID]);
    expect(settings?.default_currency).toBe('USD');
    expect(settings?.fiscal_year_start).toBe(1);
  });

  it('should update fiscal year start month', async () => {
    await query(`
      UPDATE org_settings SET fiscal_year_start = 7 WHERE org_id = $1`, [TEST_ORG_ID]);

    const settings = await queryOne<{ fiscal_year_start: number }>(
      `SELECT fiscal_year_start FROM org_settings WHERE org_id = $1`, [TEST_ORG_ID]);
    expect(settings?.fiscal_year_start).toBe(7);
  });

  it('should update trading-related settings', async () => {
    await query(`
      UPDATE org_settings SET
        default_exchange = 'CBOT',
        commission_default = 2.50,
        roll_critical_days = 5,
        roll_urgent_days = 10,
        roll_upcoming_days = 30
      WHERE org_id = $1`, [TEST_ORG_ID]);

    const settings = await queryOne<{
      default_exchange: string;
      commission_default: string;
      roll_critical_days: number;
      roll_urgent_days: number;
    }>(`SELECT default_exchange, commission_default, roll_critical_days, roll_urgent_days
        FROM org_settings WHERE org_id = $1`, [TEST_ORG_ID]);

    expect(settings?.default_exchange).toBe('CBOT');
    expect(Number(settings?.commission_default)).toBe(2.50);
    expect(settings?.roll_critical_days).toBe(5);
    expect(settings?.roll_urgent_days).toBe(10);
  });

  it('should update budget settings', async () => {
    await query(`
      UPDATE org_settings SET
        budget_lock_after_approval = true,
        budget_variance_threshold = 15
      WHERE org_id = $1`, [TEST_ORG_ID]);

    const settings = await queryOne<{
      budget_lock_after_approval: boolean;
      budget_variance_threshold: string;
    }>(`SELECT budget_lock_after_approval, budget_variance_threshold
        FROM org_settings WHERE org_id = $1`, [TEST_ORG_ID]);

    expect(settings?.budget_lock_after_approval).toBe(true);
    expect(Number(settings?.budget_variance_threshold)).toBe(15);
  });

  it('should enable and disable plugins', async () => {
    // Disable market_data plugin
    await query(`
      UPDATE org_plugins SET is_enabled = false
      WHERE org_id = $1 AND plugin_id = 'market_data'`, [TEST_ORG_ID]);

    const disabled = await queryOne<{ is_enabled: boolean }>(
      `SELECT is_enabled FROM org_plugins
       WHERE org_id = $1 AND plugin_id = 'market_data'`, [TEST_ORG_ID]);
    expect(disabled?.is_enabled).toBe(false);

    // Re-enable
    await query(`
      UPDATE org_plugins SET is_enabled = true
      WHERE org_id = $1 AND plugin_id = 'market_data'`, [TEST_ORG_ID]);

    const enabled = await queryOne<{ is_enabled: boolean }>(
      `SELECT is_enabled FROM org_plugins
       WHERE org_id = $1 AND plugin_id = 'market_data'`, [TEST_ORG_ID]);
    expect(enabled?.is_enabled).toBe(true);
  });

  it('should store futures month mappings in org settings', async () => {
    const mappings = {
      CORN: { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] },
    };
    await query(`
      UPDATE org_settings SET futures_month_mappings = $1 WHERE org_id = $2`,
      [JSON.stringify(mappings), TEST_ORG_ID]);

    const settings = await queryOne<{ futures_month_mappings: Record<string, unknown> }>(
      `SELECT futures_month_mappings FROM org_settings WHERE org_id = $1`, [TEST_ORG_ID]);
    expect(settings?.futures_month_mappings).toBeDefined();
    expect((settings?.futures_month_mappings as Record<string, Record<string, number[]>>).CORN.H).toContain(12);
  });
});
