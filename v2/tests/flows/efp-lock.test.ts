import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, TEST_ORG_ID, TEST_USER_ID, TEST_SITE_ID } from '../setup';
import { createTrade } from '@/lib/tradeService';
import { allocateToSite, executeEFP } from '@/lib/positionService';
import { queryOne } from '@/lib/db';

describe('EFP Lock Flow', () => {
  let tradeId: string;
  let allocationId: string;

  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();

    // Book a trade
    const trade = await createTrade({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      commodityId: 'CORN',
      direction: 'long',
      tradeDate: '2026-03-16',
      contractMonth: 'N26',
      numContracts: 1,
      contractSize: 5000,
      tradePrice: 4.50,
    });
    tradeId = trade.id;

    // Allocate to site
    const allocation = await allocateToSite({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      tradeId: trade.id,
      siteId: TEST_SITE_ID,
      commodityId: 'CORN',
      allocatedVolume: 5000,
      budgetMonth: '2026-07',
      tradePrice: 4.50,
      tradeDate: '2026-03-16',
      contractMonth: 'N26',
      direction: 'long',
    });
    allocationId = allocation.id;
  });

  afterAll(async () => {
    await cleanTestData();
  });

  it('should execute EFP and create locked position', async () => {
    const locked = await executeEFP({
      allocationId,
      userId: TEST_USER_ID,
      lockPrice: 4.75,
      basisPrice: -0.15,
      deliveryMonth: '2026-07',
    });

    expect(locked).toBeDefined();
    expect(Number(locked.locked_price)).toBe(4.75);
    expect(Number(locked.basis_component)).toBe(-0.15);
    expect(Number(locked.volume)).toBe(5000);

    // Futures P&L: (4.75 - 4.50) * 5000 = 1250
    expect(Number(locked.futures_pnl)).toBe(1250);

    // All-in: 4.75 + (-0.15) + 0 roll cost = 4.60
    expect(Number(locked.all_in_price)).toBe(4.60);
  });

  it('should update allocation status to efp_closed', async () => {
    const allocation = await queryOne<{ status: string }>(
      `SELECT status FROM pm_allocations WHERE id = $1`, [allocationId]);
    expect(allocation?.status).toBe('efp_closed');
  });
});
