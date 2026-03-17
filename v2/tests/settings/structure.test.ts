import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, TEST_ORG_ID, TEST_SITE_ID } from '../setup';
import { query, queryOne, queryAll } from '@/lib/db';

describe('Settings: Structure Tab', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
  });
  afterAll(async () => { await cleanTestData(); });

  describe('Hierarchy Levels', () => {
    it('should create default hierarchy levels', async () => {
      const levels = [
        { depth: 0, label: 'Corporate', isSite: false },
        { depth: 1, label: 'Country', isSite: false },
        { depth: 2, label: 'Region', isSite: false },
        { depth: 3, label: 'Site', isSite: true },
      ];
      for (const l of levels) {
        await query(`
          INSERT INTO org_hierarchy_levels (org_id, level_depth, label, is_site_level)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (org_id, level_depth) DO NOTHING`,
          [TEST_ORG_ID, l.depth, l.label, l.isSite]);
      }

      const rows = await queryAll<{ level_depth: number; label: string; is_site_level: boolean }>(
        `SELECT level_depth, label, is_site_level FROM org_hierarchy_levels
         WHERE org_id = $1 ORDER BY level_depth`, [TEST_ORG_ID]);

      expect(rows.length).toBeGreaterThanOrEqual(4);
      expect(rows[0].label).toBe('Corporate');
      expect(rows[rows.length - 1].is_site_level).toBe(true);
    });

    it('should rename a hierarchy level', async () => {
      await query(`
        UPDATE org_hierarchy_levels SET label = 'Division'
        WHERE org_id = $1 AND level_depth = 1`, [TEST_ORG_ID]);

      const level = await queryOne<{ label: string }>(
        `SELECT label FROM org_hierarchy_levels
         WHERE org_id = $1 AND level_depth = 1`, [TEST_ORG_ID]);
      expect(level?.label).toBe('Division');

      // Rename back
      await query(`
        UPDATE org_hierarchy_levels SET label = 'Country'
        WHERE org_id = $1 AND level_depth = 1`, [TEST_ORG_ID]);
    });

    it('should enforce unique (org_id, level_depth)', async () => {
      // Inserting a duplicate depth should conflict
      const result = await query(`
        INSERT INTO org_hierarchy_levels (org_id, level_depth, label, is_site_level)
        VALUES ($1, 0, 'Duplicate', false)
        ON CONFLICT (org_id, level_depth) DO NOTHING`,
        [TEST_ORG_ID]);

      // The ON CONFLICT should have done nothing — still only one depth=0 row
      const rows = await queryAll<{ label: string }>(
        `SELECT label FROM org_hierarchy_levels
         WHERE org_id = $1 AND level_depth = 0`, [TEST_ORG_ID]);
      expect(rows.length).toBe(1);
      expect(rows[0].label).toBe('Corporate');
    });
  });

  describe('Org Units (tree nodes)', () => {
    it('should create org units at each level', async () => {
      // Create Corporate unit
      await query(`
        INSERT INTO org_units (id, org_id, name, code, hierarchy_level_id)
        VALUES ('00000000-0000-0000-0000-000000000050', $1, 'TestCorp', 'TC',
          (SELECT id FROM org_hierarchy_levels WHERE org_id = $1 AND level_depth = 0 LIMIT 1))
        ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID]);

      // Create Country units under Corporate
      const corporate = await queryOne<{ id: string }>(
        `SELECT id FROM org_units WHERE org_id = $1 AND code = 'TC'`, [TEST_ORG_ID]);

      await query(`
        INSERT INTO org_units (id, org_id, name, code, parent_id, hierarchy_level_id)
        VALUES ('00000000-0000-0000-0000-000000000051', $1, 'Canada', 'CA', $2,
          (SELECT id FROM org_hierarchy_levels WHERE org_id = $1 AND level_depth = 1 LIMIT 1))
        ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID, corporate?.id]);

      await query(`
        INSERT INTO org_units (id, org_id, name, code, parent_id, hierarchy_level_id)
        VALUES ('00000000-0000-0000-0000-000000000052', $1, 'United States', 'US', $2,
          (SELECT id FROM org_hierarchy_levels WHERE org_id = $1 AND level_depth = 1 LIMIT 1))
        ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID, corporate?.id]);

      const countries = await queryAll<{ name: string }>(
        `SELECT name FROM org_units WHERE org_id = $1 AND parent_id = $2 ORDER BY name`,
        [TEST_ORG_ID, corporate?.id]);
      expect(countries.length).toBe(2);
      expect(countries.map(c => c.name)).toContain('Canada');
      expect(countries.map(c => c.name)).toContain('United States');
    });

    it('should not allow creating an org unit with invalid parent', async () => {
      // parent_id FK constraint should prevent referencing non-existent parent
      try {
        await query(`
          INSERT INTO org_units (id, org_id, name, code, parent_id, hierarchy_level_id)
          VALUES ('00000000-0000-0000-0000-0000000000FF', $1, 'BadParent', 'BP',
            '00000000-0000-0000-0000-FFFFFFFFFFFF',
            (SELECT id FROM org_hierarchy_levels WHERE org_id = $1 AND level_depth = 1 LIMIT 1))`,
          [TEST_ORG_ID]);
        expect.fail('Should have thrown FK violation');
      } catch (err) {
        expect((err as Error).message).toMatch(/violates foreign key/);
      }
    });

    it('should create a site linked to an org unit', async () => {
      const canada = await queryOne<{ id: string }>(
        `SELECT id FROM org_units WHERE org_id = $1 AND code = 'CA'`, [TEST_ORG_ID]);

      await query(`
        INSERT INTO sites (id, org_id, name, code, site_type_id, org_unit_id)
        VALUES ('00000000-0000-0000-0000-000000000060', $1, 'Lethbridge', 'LB1', 'grain_elevator', $2)
        ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID, canada?.id]);

      const site = await queryOne<{ name: string; org_unit_id: string }>(
        `SELECT name, org_unit_id FROM sites WHERE id = '00000000-0000-0000-0000-000000000060'`);
      expect(site?.name).toBe('Lethbridge');
      expect(site?.org_unit_id).toBe(canada?.id);
    });

    it('should list sites under a parent org unit', async () => {
      const canada = await queryOne<{ id: string }>(
        `SELECT id FROM org_units WHERE org_id = $1 AND code = 'CA'`, [TEST_ORG_ID]);

      const sites = await queryAll<{ name: string }>(
        `SELECT name FROM sites WHERE org_id = $1 AND org_unit_id = $2`,
        [TEST_ORG_ID, canada?.id]);
      expect(sites.length).toBeGreaterThanOrEqual(1);
      expect(sites.map(s => s.name)).toContain('Lethbridge');
    });

    it('should delete a leaf org unit without sites', async () => {
      // Create a temporary unit and delete it
      await query(`
        INSERT INTO org_units (id, org_id, name, code, parent_id, hierarchy_level_id)
        VALUES ('00000000-0000-0000-0000-000000000053', $1, 'Temp', 'TMP',
          '00000000-0000-0000-0000-000000000050',
          (SELECT id FROM org_hierarchy_levels WHERE org_id = $1 AND level_depth = 1 LIMIT 1))`,
        [TEST_ORG_ID]);

      await query(`DELETE FROM org_units WHERE id = '00000000-0000-0000-0000-000000000053'`);

      const deleted = await queryOne<{ id: string }>(
        `SELECT id FROM org_units WHERE id = '00000000-0000-0000-0000-000000000053'`);
      expect(deleted).toBeNull();
    });
  });
});
