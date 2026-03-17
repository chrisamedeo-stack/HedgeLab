import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, TEST_ORG_ID, TEST_USER_ID, TEST_SITE_ID } from '../setup';
import { query, queryOne, queryAll } from '@/lib/db';
import { createCounterparty, listCounterparties, deleteCounterparty } from '@/lib/contractService';

describe('Settings: Suppliers & Counterparties', () => {
  let cargillId: string;

  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();

    // Seed counterparty permissions for the admin role
    for (const perm of ['counterparty.view', 'counterparty.create', 'counterparty.update', 'counterparty.delete']) {
      await query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ('admin', $1)
        ON CONFLICT (role_id, permission_id) DO NOTHING`, [perm]);
    }
  });
  afterAll(async () => { await cleanTestData(); });

  describe('Counterparty CRUD', () => {
    it('should create a counterparty', async () => {
      const cp = await createCounterparty({
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        name: 'Cargill Inc',
        shortName: 'CARG',
        counterpartyType: 'commercial',
        creditLimit: 5000000,
        creditRating: 'A',
        paymentTermsDays: 30,
        contactName: 'John Smith',
        contactEmail: 'john@cargill.com',
      });

      expect(cp).toBeDefined();
      expect(cp.name).toBe('Cargill Inc');
      expect(cp.short_name).toBe('CARG');
      expect(cp.is_active).toBe(true);
      cargillId = cp.id;
    });

    it('should create a second counterparty', async () => {
      const cp = await createCounterparty({
        orgId: TEST_ORG_ID,
        userId: TEST_USER_ID,
        name: 'ADM',
        shortName: 'ADM',
        counterpartyType: 'commercial',
      });
      expect(cp.name).toBe('ADM');
    });

    it('should list counterparties for the org', async () => {
      const list = await listCounterparties({ orgId: TEST_ORG_ID });
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.map(c => c.short_name)).toContain('CARG');
      expect(list.map(c => c.short_name)).toContain('ADM');
    });

    it('should deactivate a counterparty (soft delete)', async () => {
      const list = await listCounterparties({ orgId: TEST_ORG_ID });
      const adm = list.find(c => c.short_name === 'ADM');

      await deleteCounterparty(adm!.id, TEST_USER_ID);

      const updated = await queryOne<{ is_active: boolean }>(
        `SELECT is_active FROM ct_counterparties WHERE id = $1`, [adm!.id]);
      expect(updated?.is_active).toBe(false);
    });

    it('should filter to only active counterparties', async () => {
      const active = await listCounterparties({ orgId: TEST_ORG_ID, isActive: true });
      expect(active.map(c => c.short_name)).toContain('CARG');
      expect(active.map(c => c.short_name)).not.toContain('ADM');
    });
  });

  describe('Site Suppliers (linking)', () => {
    it('should link a counterparty to a site', async () => {
      await query(`
        INSERT INTO site_suppliers (site_id, counterparty_id)
        VALUES ($1, $2)
        ON CONFLICT (site_id, counterparty_id) DO NOTHING`,
        [TEST_SITE_ID, cargillId]);

      const link = await queryOne<{ counterparty_id: string }>(
        `SELECT counterparty_id FROM site_suppliers
         WHERE site_id = $1 AND counterparty_id = $2`,
        [TEST_SITE_ID, cargillId]);
      expect(link).toBeDefined();
      expect(link?.counterparty_id).toBe(cargillId);
    });

    it('should prevent duplicate site-supplier links', async () => {
      const result = await query(`
        INSERT INTO site_suppliers (site_id, counterparty_id)
        VALUES ($1, $2)
        ON CONFLICT (site_id, counterparty_id) DO NOTHING`,
        [TEST_SITE_ID, cargillId]);

      const links = await queryAll<{ id: string }>(
        `SELECT id FROM site_suppliers
         WHERE site_id = $1 AND counterparty_id = $2`,
        [TEST_SITE_ID, cargillId]);
      expect(links.length).toBe(1);
    });

    it('should list suppliers for a site with names', async () => {
      const suppliers = await queryAll<{ name: string; short_name: string }>(
        `SELECT cp.name, cp.short_name
         FROM site_suppliers ss
         JOIN ct_counterparties cp ON cp.id = ss.counterparty_id
         WHERE ss.site_id = $1`, [TEST_SITE_ID]);

      expect(suppliers.length).toBeGreaterThanOrEqual(1);
      expect(suppliers[0].short_name).toBe('CARG');
    });

    it('should unlink a supplier from a site', async () => {
      await query(`
        DELETE FROM site_suppliers
        WHERE site_id = $1 AND counterparty_id = $2`,
        [TEST_SITE_ID, cargillId]);

      const link = await queryOne<{ id: string }>(
        `SELECT id FROM site_suppliers
         WHERE site_id = $1 AND counterparty_id = $2`,
        [TEST_SITE_ID, cargillId]);
      expect(link).toBeNull();
    });
  });
});
