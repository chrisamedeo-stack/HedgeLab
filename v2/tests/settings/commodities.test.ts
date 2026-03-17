import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg } from '../setup';
import { query, queryOne, queryAll } from '@/lib/db';

describe('Settings: Commodities Tab', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
  });
  afterAll(async () => { await cleanTestData(); });

  describe('Commodity CRUD', () => {
    it('should create a new commodity with minimal fields', async () => {
      await query(`
        INSERT INTO commodities (id, name, category, unit, currency)
        VALUES ('TEST_CRUDE', 'WTI Crude Oil', 'energy', 'barrels', 'USD')
        ON CONFLICT (id) DO NOTHING`);

      const commodity = await queryOne<{ id: string; name: string; unit: string }>(
        `SELECT id, name, unit FROM commodities WHERE id = 'TEST_CRUDE'`);
      expect(commodity?.name).toBe('WTI Crude Oil');
      expect(commodity?.unit).toBe('barrels');
    });

    it('should update commodity with full config', async () => {
      await query(`
        UPDATE commodities SET
          display_name = 'WTI Crude Oil',
          commodity_class = 'energy',
          ticker_root = 'CL',
          exchange = 'NYMEX',
          contract_size = 1000,
          tick_size = 0.01,
          tick_value = 10.00,
          trade_price_unit = '$/bbl',
          trade_volume_unit = 'barrels',
          price_decimal_places = 2,
          contract_months = 'FGHJKMNQUVXZ',
          basis_unit = '$/bbl',
          basis_reference = 'NYMEX WTI front month'
        WHERE id = 'TEST_CRUDE'`);

      const c = await queryOne<{
        ticker_root: string; contract_size: string;
        trade_price_unit: string; contract_months: string;
      }>(`SELECT ticker_root, contract_size, trade_price_unit, contract_months
          FROM commodities WHERE id = 'TEST_CRUDE'`);

      expect(c?.ticker_root).toBe('CL');
      expect(Number(c?.contract_size)).toBe(1000);
      expect(c?.trade_price_unit).toBe('$/bbl');
      expect(c?.contract_months).toBe('FGHJKMNQUVXZ');
    });

    it('should verify existing seeded commodities are present', async () => {
      const corn = await queryOne<{ id: string; contract_size: string }>(
        `SELECT id, contract_size FROM commodities WHERE id = 'CORN'`);
      expect(corn).toBeDefined();
      expect(Number(corn?.contract_size)).toBe(5000);
    });

    it('should deactivate a commodity', async () => {
      await query(`UPDATE commodities SET is_active = false WHERE id = 'TEST_CRUDE'`);
      const c = await queryOne<{ is_active: boolean }>(
        `SELECT is_active FROM commodities WHERE id = 'TEST_CRUDE'`);
      expect(c?.is_active).toBe(false);

      // Reactivate
      await query(`UPDATE commodities SET is_active = true WHERE id = 'TEST_CRUDE'`);
    });
  });

  describe('Futures Budget Mapping', () => {
    it('should store grain-standard mapping', async () => {
      const mapping = { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] };
      await query(`UPDATE commodities SET futures_budget_mapping = $1 WHERE id = 'CORN'`,
        [JSON.stringify(mapping)]);

      const c = await queryOne<{ futures_budget_mapping: Record<string, number[]> }>(
        `SELECT futures_budget_mapping FROM commodities WHERE id = 'CORN'`);
      expect(c?.futures_budget_mapping).toBeDefined();
      expect(c?.futures_budget_mapping.H).toContain(12);
      expect(c?.futures_budget_mapping.H).toContain(1);
      expect(c?.futures_budget_mapping.H).toContain(2);
      expect(c?.futures_budget_mapping.K).toEqual([3, 4]);
    });

    it('should store 1:1 energy mapping', async () => {
      const mapping: Record<string, number[]> = {};
      const codes = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
      codes.forEach((code, i) => { mapping[code] = [i + 1]; });

      await query(`UPDATE commodities SET futures_budget_mapping = $1 WHERE id = 'TEST_CRUDE'`,
        [JSON.stringify(mapping)]);

      const c = await queryOne<{ futures_budget_mapping: Record<string, number[]> }>(
        `SELECT futures_budget_mapping FROM commodities WHERE id = 'TEST_CRUDE'`);
      expect(c?.futures_budget_mapping.F).toEqual([1]);
      expect(c?.futures_budget_mapping.Z).toEqual([12]);
    });

    it('should validate every month is covered exactly once', () => {
      const mapping = { H: [12, 1, 2], K: [3, 4], N: [5, 6], U: [7, 8], Z: [9, 10, 11] };
      const allMonths = Object.values(mapping).flat().sort((a, b) => a - b);
      expect(allMonths).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      expect(new Set(allMonths).size).toBe(12);
    });
  });

  describe('Reporting Units', () => {
    it('should create reporting units for a commodity', async () => {
      await query(`
        INSERT INTO commodity_units (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit, is_default_report, sort_order)
        VALUES
          ('TEST_CRUDE', 'Barrels', 'bbl', 1, 1, false, 0),
          ('TEST_CRUDE', 'Metric tons', 'MT', 0.1364, 7.33, true, 1)
        ON CONFLICT (commodity_id, abbreviation) DO NOTHING`);

      const units = await queryAll<{ unit_name: string; abbreviation: string; is_default_report: boolean }>(
        `SELECT unit_name, abbreviation, is_default_report FROM commodity_units
         WHERE commodity_id = 'TEST_CRUDE' ORDER BY sort_order`);

      expect(units.length).toBe(2);
      expect(units[0].abbreviation).toBe('bbl');
      expect(units[1].abbreviation).toBe('MT');
      expect(units[1].is_default_report).toBe(true);
    });

    it('should enforce unique (commodity_id, abbreviation)', async () => {
      // Inserting a duplicate abbreviation should conflict
      const result = await query(`
        INSERT INTO commodity_units (commodity_id, unit_name, abbreviation, to_trade_unit, from_trade_unit)
        VALUES ('TEST_CRUDE', 'Barrels Dup', 'bbl', 1, 1)
        ON CONFLICT (commodity_id, abbreviation) DO NOTHING`);

      const units = await queryAll<{ unit_name: string }>(
        `SELECT unit_name FROM commodity_units
         WHERE commodity_id = 'TEST_CRUDE' AND abbreviation = 'bbl'`);
      expect(units.length).toBe(1);
      expect(units[0].unit_name).toBe('Barrels');
    });

    it('should verify conversion math is reciprocal', async () => {
      const mt = await queryOne<{ to_trade_unit: string; from_trade_unit: string }>(
        `SELECT to_trade_unit, from_trade_unit FROM commodity_units
         WHERE commodity_id = 'TEST_CRUDE' AND abbreviation = 'MT'`);

      if (mt) {
        const forward = Number(mt.to_trade_unit);
        const inverse = Number(mt.from_trade_unit);
        // forward * inverse should ≈ 1
        expect(Math.abs(forward * inverse - 1)).toBeLessThan(0.01);
      }
    });
  });
});
