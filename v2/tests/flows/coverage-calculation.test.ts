import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, seedBudgetPeriod, TEST_ORG_ID, TEST_USER_ID, TEST_SITE_ID } from '../setup';
import { createTrade } from '@/lib/tradeService';
import { allocateToSite, createPhysicalPosition } from '@/lib/positionService';
import { getCoverageSummary } from '@/lib/budgetService';

const PERIOD_ID = '00000000-0000-0000-0000-000000000010';

describe('Coverage Calculation', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();

    // Create budget: 10,000 bu for July 2026 only
    await seedBudgetPeriod(PERIOD_ID, { months: ['2026-07'], volume: 10000 });

    // Book and allocate a hedge: 3000 bu
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

    await allocateToSite({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      tradeId: trade.id,
      siteId: TEST_SITE_ID,
      commodityId: 'CORN',
      allocatedVolume: 3000,
      budgetMonth: '2026-07',
      tradePrice: 4.50,
      tradeDate: '2026-03-16',
      contractMonth: 'N26',
      direction: 'long',
    });

    // Enter a physical commitment: 2000 bu
    await createPhysicalPosition({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      siteId: TEST_SITE_ID,
      commodityId: 'CORN',
      direction: 'buy',
      volume: 2000,
      price: 4.25,
      pricingType: 'fixed',
      deliveryMonth: '2026-07',
    });

    // Wait for event processing
    await new Promise(r => setTimeout(r, 1000));
  });

  afterAll(async () => {
    await cleanTestData();
  });

  it('should calculate coverage correctly', async () => {
    const summary = await getCoverageSummary(TEST_ORG_ID, 'CORN', TEST_SITE_ID);

    // Budget: 10,000, Hedged: 3,000, Committed: 2,000
    // Coverage = (3000 + 2000) / 10000 = 50%
    expect(summary.totalBudgeted).toBe(10000);
    expect(summary.totalHedged).toBe(3000);
    expect(summary.totalCommitted).toBe(2000);
    expect(summary.overallCoveragePct).toBe(50);

    const july = summary.byMonth.find(m => m.month === '2026-07');
    expect(july).toBeDefined();
    expect(july!.hedged).toBe(3000);
    expect(july!.committed).toBe(2000);
    expect(july!.open).toBe(5000);
    expect(july!.coveragePct).toBe(50);
  });
});
