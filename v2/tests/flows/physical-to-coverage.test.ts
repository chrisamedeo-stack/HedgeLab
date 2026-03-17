import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, seedBudgetPeriod, TEST_ORG_ID, TEST_USER_ID, TEST_SITE_ID } from '../setup';
import { createContract } from '@/lib/contractService';
import { query, queryOne } from '@/lib/db';

const PERIOD_ID = '00000000-0000-0000-0000-000000000002';

describe('Physical Contract → Budget Committed Flow', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
    await seedBudgetPeriod(PERIOD_ID);

    // Seed a counterparty
    await query(`
      INSERT INTO ct_counterparties (id, org_id, name, short_name, counterparty_type)
      VALUES ('00000000-0000-0000-0000-000000000003', $1, 'Cargill', 'CARG', 'commercial')
      ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID]);
  });

  afterAll(async () => {
    await cleanTestData();
  });

  it('should create physical contract', async () => {
    const contract = await createContract({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      counterpartyId: '00000000-0000-0000-0000-000000000003',
      commodityId: 'CORN',
      siteId: TEST_SITE_ID,
      contractType: 'purchase',
      direction: 'buy',
      totalVolume: 8000,
      price: 4.25,
      pricingType: 'fixed',
      currency: 'USD',
      deliveryStart: '2026-07-01',
      deliveryEnd: '2026-07-31',
    });

    expect(contract).toBeDefined();
    expect(contract.id).toBeDefined();
    expect(Number(contract.total_volume)).toBe(8000);
  });

  it('should update budget committed_volume via event', async () => {
    await new Promise(r => setTimeout(r, 500));

    const lineItem = await queryOne<{ committed_volume: string }>(
      `SELECT committed_volume FROM bgt_line_items
       WHERE period_id = $1 AND budget_month = '2026-07'`, [PERIOD_ID]
    );

    expect(lineItem).not.toBeNull();
    expect(Number(lineItem!.committed_volume)).toBe(8000);
  });

  it('should also create a pm_physical_position', async () => {
    const physical = await queryOne<{ volume: string }>(
      `SELECT volume FROM pm_physical_positions
       WHERE org_id = $1 AND commodity_id = 'CORN' AND site_id = $2`,
      [TEST_ORG_ID, TEST_SITE_ID]
    );

    expect(physical).toBeDefined();
    expect(Number(physical!.volume)).toBe(8000);
  });
});
