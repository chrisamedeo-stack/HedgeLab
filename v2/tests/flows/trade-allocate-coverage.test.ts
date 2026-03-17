import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, seedBudgetPeriod, TEST_ORG_ID, TEST_USER_ID, TEST_SITE_ID } from '../setup';
import { createTrade, getTrade } from '@/lib/tradeService';
import { allocateToSite } from '@/lib/positionService';
import { queryOne } from '@/lib/db';

const PERIOD_ID = '00000000-0000-0000-0000-000000000001';

describe('Trade → Allocate → Coverage Flow', () => {
  let tradeId: string;

  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
    await seedBudgetPeriod(PERIOD_ID);
  });

  afterAll(async () => {
    await cleanTestData();
  });

  it('should book a futures trade', async () => {
    const trade = await createTrade({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      commodityId: 'CORN',
      direction: 'long',
      tradeDate: '2026-03-16',
      contractMonth: 'N26',
      numContracts: 2,
      contractSize: 5000,
      tradePrice: 4.50,
    });

    expect(trade).toBeDefined();
    expect(trade.id).toBeDefined();
    expect(Number(trade.total_volume)).toBe(10000);
    expect(Number(trade.allocated_volume)).toBe(0);
    expect(trade.status).toBe('open');

    tradeId = trade.id;
  });

  it('should allocate trade to site and update trade allocated_volume', async () => {
    const allocation = await allocateToSite({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      tradeId,
      siteId: TEST_SITE_ID,
      commodityId: 'CORN',
      allocatedVolume: 5000,
      budgetMonth: '2026-05',
      tradePrice: 4.50,
      tradeDate: '2026-03-16',
      contractMonth: 'N26',
      direction: 'long',
    });

    expect(allocation).toBeDefined();
    expect(allocation.status).toBe('open');
    expect(Number(allocation.allocated_volume)).toBe(5000);

    // CRITICAL CHECK: trade's allocated_volume should be updated
    const updatedTrade = await getTrade(tradeId);
    expect(Number(updatedTrade!.allocated_volume)).toBe(5000);
    expect(Number(updatedTrade!.unallocated_volume)).toBe(5000);
    expect(updatedTrade!.status).toBe('partially_allocated');
  });

  it('should update budget hedged_volume via event', async () => {
    // Wait a moment for async event processing
    await new Promise(r => setTimeout(r, 500));

    const lineItem = await queryOne<{ hedged_volume: string }>(
      `SELECT hedged_volume FROM bgt_line_items
       WHERE period_id = $1 AND budget_month = '2026-05'`, [PERIOD_ID]
    );

    expect(lineItem).not.toBeNull();
    expect(Number(lineItem!.hedged_volume)).toBe(5000);
  });

  it('should fully allocate and update trade status', async () => {
    await allocateToSite({
      orgId: TEST_ORG_ID,
      userId: TEST_USER_ID,
      tradeId,
      siteId: TEST_SITE_ID,
      commodityId: 'CORN',
      allocatedVolume: 5000,
      budgetMonth: '2026-06',
      tradePrice: 4.50,
      tradeDate: '2026-03-16',
      contractMonth: 'N26',
      direction: 'long',
    });

    const updatedTrade = await getTrade(tradeId);
    expect(Number(updatedTrade!.allocated_volume)).toBe(10000);
    expect(Number(updatedTrade!.unallocated_volume)).toBe(0);
    expect(updatedTrade!.status).toBe('fully_allocated');
  });
});
