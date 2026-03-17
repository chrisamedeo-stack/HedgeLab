import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanTestData, seedTestOrg, TEST_ORG_ID, TEST_USER_ID } from '../setup';
import { query, queryOne, queryAll } from '@/lib/db';

describe('Settings: Users', () => {
  beforeAll(async () => {
    await cleanTestData();
    await seedTestOrg();
  });
  afterAll(async () => { await cleanTestData(); });

  it('should create a new user', async () => {
    await query(`
      INSERT INTO users (id, org_id, email, name, role_id)
      VALUES ('00000000-0000-0000-0000-000000000070', $1, 'trader@hedgelab.com', 'Jane Trader', 'trader')
      ON CONFLICT (id) DO NOTHING`, [TEST_ORG_ID]);

    const user = await queryOne<{ email: string; role_id: string; name: string }>(
      `SELECT email, role_id, name FROM users WHERE id = '00000000-0000-0000-0000-000000000070'`);
    expect(user?.email).toBe('trader@hedgelab.com');
    expect(user?.name).toBe('Jane Trader');
    expect(user?.role_id).toBe('trader');
  });

  it('should update user role', async () => {
    await query(`
      UPDATE users SET role_id = 'risk_manager'
      WHERE id = '00000000-0000-0000-0000-000000000070'`);

    const user = await queryOne<{ role_id: string }>(
      `SELECT role_id FROM users WHERE id = '00000000-0000-0000-0000-000000000070'`);
    expect(user?.role_id).toBe('risk_manager');
  });

  it('should list users for the org', async () => {
    const users = await queryAll<{ email: string }>(
      `SELECT email FROM users WHERE org_id = $1 ORDER BY email`, [TEST_ORG_ID]);
    expect(users.length).toBeGreaterThanOrEqual(2);
    expect(users.map(u => u.email)).toContain('test@hedgelab.com');
    expect(users.map(u => u.email)).toContain('trader@hedgelab.com');
  });

  it('should enforce unique email constraint', async () => {
    try {
      await query(`
        INSERT INTO users (id, org_id, email, name, role_id)
        VALUES (gen_random_uuid(), $1, 'trader@hedgelab.com', 'Duplicate', 'viewer')`,
        [TEST_ORG_ID]);
      expect.fail('Should have thrown unique constraint violation');
    } catch (err) {
      expect((err as Error).message).toMatch(/unique|duplicate/i);
    }
  });

  it('should verify admin role has all key permissions', async () => {
    const perms = await queryAll<{ permission_id: string }>(
      `SELECT rp.permission_id FROM role_permissions rp
       WHERE rp.role_id = 'admin'`);
    expect(perms.length).toBeGreaterThan(10);
    const permIds = perms.map(p => p.permission_id);
    expect(permIds).toContain('trade.create');
    expect(permIds).toContain('position.allocate');
    expect(permIds).toContain('budget.approve');
  });

  it('should verify role FK constraint', async () => {
    try {
      await query(`
        INSERT INTO users (id, org_id, email, name, role_id)
        VALUES (gen_random_uuid(), $1, 'bad@hedgelab.com', 'Bad Role', 'nonexistent_role')`,
        [TEST_ORG_ID]);
      expect.fail('Should have thrown FK violation');
    } catch (err) {
      expect((err as Error).message).toMatch(/violates foreign key/);
    }
  });
});
