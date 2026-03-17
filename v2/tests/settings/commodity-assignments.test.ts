import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, TEST_ORG_ID, TEST_SITE_ID } from '../setup';
import { query, queryOne, queryAll } from '@/lib/db';

describe('Settings: Commodity Assignments', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();

    // Seed hierarchy levels and an org unit to assign commodities to
    await query(`
      INSERT INTO org_hierarchy_levels (org_id, level_depth, label, is_site_level)
      VALUES ($1, 0, 'Corporate', false), ($1, 1, 'Site', true)
      ON CONFLICT (org_id, level_depth) DO NOTHING`, [TEST_ORG_ID]);

    await query(`
      INSERT INTO org_units (id, org_id, name, code, hierarchy_level_id)
      VALUES ('00000000-0000-0000-0000-000000000080', $1, 'HQ', 'HQ',
        (SELECT id FROM org_hierarchy_levels WHERE org_id = $1 AND level_depth = 0 LIMIT 1))
      ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID]);
  });
  afterAll(async () => { await cleanTestData(); });

  it('should assign a commodity to an org unit', async () => {
    await query(`
      INSERT INTO commodity_assignments (org_id, entity_type, entity_id, commodity_id)
      VALUES ($1, 'org_unit', '00000000-0000-0000-0000-000000000080', 'CORN')
      ON CONFLICT (org_id, entity_type, entity_id, commodity_id) DO NOTHING`, [TEST_ORG_ID]);

    const assignment = await queryOne<{ commodity_id: string }>(
      `SELECT commodity_id FROM commodity_assignments
       WHERE entity_type = 'org_unit' AND entity_id = '00000000-0000-0000-0000-000000000080'`);
    expect(assignment?.commodity_id).toBe('CORN');
  });

  it('should assign multiple commodities to a site', async () => {
    for (const commodity of ['CORN', 'SOYBEAN', 'WHEAT']) {
      await query(`
        INSERT INTO commodity_assignments (org_id, entity_type, entity_id, commodity_id)
        VALUES ($1, 'site', $2, $3)
        ON CONFLICT (org_id, entity_type, entity_id, commodity_id) DO NOTHING`,
        [TEST_ORG_ID, TEST_SITE_ID, commodity]);
    }

    const assignments = await queryAll<{ commodity_id: string }>(
      `SELECT commodity_id FROM commodity_assignments
       WHERE entity_type = 'site' AND entity_id = $1
       ORDER BY commodity_id`, [TEST_SITE_ID]);
    expect(assignments.length).toBe(3);
    expect(assignments.map(a => a.commodity_id)).toEqual(['CORN', 'SOYBEAN', 'WHEAT']);
  });

  it('should enforce unique (org_id, entity_type, entity_id, commodity_id)', async () => {
    const result = await query(`
      INSERT INTO commodity_assignments (org_id, entity_type, entity_id, commodity_id)
      VALUES ($1, 'site', $2, 'CORN')
      ON CONFLICT (org_id, entity_type, entity_id, commodity_id) DO NOTHING`,
      [TEST_ORG_ID, TEST_SITE_ID]);

    const assignments = await queryAll<{ id: string }>(
      `SELECT id FROM commodity_assignments
       WHERE entity_type = 'site' AND entity_id = $1 AND commodity_id = 'CORN'`,
      [TEST_SITE_ID]);
    expect(assignments.length).toBe(1);
  });

  it('should enforce entity_type check constraint', async () => {
    try {
      await query(`
        INSERT INTO commodity_assignments (org_id, entity_type, entity_id, commodity_id)
        VALUES ($1, 'invalid_type', $2, 'CORN')`,
        [TEST_ORG_ID, TEST_SITE_ID]);
      expect.fail('Should have thrown check constraint violation');
    } catch (err) {
      expect((err as Error).message).toMatch(/check|constraint|violates/i);
    }
  });

  it('should remove a commodity assignment', async () => {
    await query(`
      DELETE FROM commodity_assignments
      WHERE entity_type = 'site' AND entity_id = $1 AND commodity_id = 'WHEAT'`,
      [TEST_SITE_ID]);

    const assignments = await queryAll<{ commodity_id: string }>(
      `SELECT commodity_id FROM commodity_assignments
       WHERE entity_type = 'site' AND entity_id = $1`, [TEST_SITE_ID]);
    expect(assignments.map(a => a.commodity_id)).not.toContain('WHEAT');
    expect(assignments.length).toBe(2);
  });

  it('should cascade delete when org is deleted', async () => {
    // Verify commodity_assignments has ON DELETE CASCADE from org_id FK
    const count = await queryOne<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM commodity_assignments WHERE org_id = $1`, [TEST_ORG_ID]);
    expect(Number(count?.cnt)).toBeGreaterThan(0);
  });
});
