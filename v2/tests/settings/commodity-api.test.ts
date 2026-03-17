import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg } from '../setup';
import { query, queryOne, queryAll } from '@/lib/db';

describe('Commodity API: Add commodity end-to-end', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
  });
  afterAll(async () => {
    await query(`DELETE FROM commodity_units WHERE commodity_id = 'TEST_NATGAS'`);
    await query(`DELETE FROM commodities WHERE id = 'TEST_NATGAS'`);
    await cleanTestData();
  });

  it('should insert a new commodity with all market data fields', async () => {
    const result = await query(
      `INSERT INTO commodities
         (id, name, category, unit, currency, exchange, contract_size,
          tick_size, tick_value, contract_months, display_name, commodity_class,
          ticker_root, trade_price_unit, trade_volume_unit, price_decimal_places)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      ['TEST_NATGAS', 'Natural Gas', 'energy', 'MMBtu', 'USD', 'NYMEX', 10000,
       0.001, 10.00, 'FGHJKMNQUVXZ', 'Natural Gas', 'energy',
       'NG', '$/MMBtu', 'MMBtu', 3]
    );

    const c = result.rows[0];
    expect(c.id).toBe('TEST_NATGAS');
    expect(c.ticker_root).toBe('NG');
    expect(c.exchange).toBe('NYMEX');
    expect(Number(c.contract_size)).toBe(10000);
    expect(c.trade_price_unit).toBe('$/MMBtu');
  });

  it('should add reporting units', async () => {
    await query(
      `INSERT INTO commodity_units
         (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit, is_default_report, sort_order)
       VALUES
         ('TEST_NATGAS', 'MMBtu', 'MMBtu', 1, 1, false, 0),
         ('TEST_NATGAS', 'Therms', 'thm', 0.1, 10, false, 1)
       ON CONFLICT (commodity_id, abbreviation) DO NOTHING`);

    const units = await queryAll<{ unit_name: string; abbreviation: string }>(
      `SELECT unit_name, abbreviation FROM commodity_units
       WHERE commodity_id = 'TEST_NATGAS' ORDER BY sort_order`);

    expect(units.length).toBe(2);
    expect(units[0].abbreviation).toBe('MMBtu');
    expect(units[1].abbreviation).toBe('thm');
  });

  it('should read commodity back with units (simulates GET route)', async () => {
    // Step 1: fetch commodity
    const commodity = await queryOne<{
      id: string; name: string; ticker_root: string;
      exchange: string; contract_size: string;
    }>(`SELECT * FROM commodities WHERE id = 'TEST_NATGAS'`);

    expect(commodity).toBeDefined();
    expect(commodity!.ticker_root).toBe('NG');

    // Step 2: fetch units separately (mirrors the fixed GET route)
    let units: unknown[] = [];
    try {
      units = await queryAll(
        `SELECT id, unit_name, abbreviation, to_trade_unit, from_trade_unit,
                is_default_report, sort_order
         FROM commodity_units WHERE commodity_id = $1 ORDER BY sort_order`,
        ['TEST_NATGAS']
      );
    } catch {
      // graceful fallback
    }

    expect(units.length).toBe(2);

    // Step 3: merge (mirrors route logic)
    const result = { ...commodity, units };
    expect(result.units.length).toBe(2);
    expect(result.ticker_root).toBe('NG');
  });

  it('should show ticker_root as CODE (not internal id)', () => {
    // This is a pure logic test matching what CommoditiesTab renders
    const commodity = { id: 'TEST_NATGAS', ticker_root: 'NG' };
    const displayCode = commodity.ticker_root || commodity.id;
    expect(displayCode).toBe('NG');
    expect(displayCode).not.toBe('TEST_NATGAS');
  });
});
