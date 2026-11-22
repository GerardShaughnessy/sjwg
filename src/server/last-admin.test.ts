import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { HttpError } from './http';
import { dropsAdmin, type UserPatch } from './permissions';

/**
 * The database stand-in: records the UPDATE's WHERE and returns whatever rows
 * the test says Postgres would. With the EXISTS guard failing (no other
 * enabled Admin), Postgres updates nothing, so `returning` is empty.
 */
const fake = vi.hoisted(() => ({ where: null as unknown, rows: [] as unknown[] }));
vi.mock('./db/client', () => ({
  db: () => ({
    update: () => ({
      set: () => ({
        where: (w: unknown) => {
          fake.where = w;
          return { returning: async () => fake.rows };
        },
      }),
    }),
  }),
}));
const { updateUser } = await import('./db/queries/users');

const whereSql = () => new PgDialect().sqlToQuery(fake.where as SQL);

const ADMIN_B = { id: 'admin-b', role: 'admin' as const, siteAdmin: true, disabled: false };
const OFFICER = { id: 'off-1', role: 'admin' as const, siteAdmin: false, disabled: false };

async function statusOf(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (err) {
    if (err instanceof HttpError) return err.status;
    throw err;
  }
}

beforeEach(() => {
  fake.where = null;
  fake.rows = [];
});

describe('the site always keeps an Admin', () => {
  it('knows which patches take the Admin level away', () => {
    const drops: UserPatch[] = [{ siteAdmin: false }, { role: 'member' }, { disabled: true }];
    for (const p of drops) expect(dropsAdmin(ADMIN_B, p)).toBe(true);
    expect(dropsAdmin(ADMIN_B, { title: 'Chair' })).toBe(false);
    expect(dropsAdmin(ADMIN_B, { disabled: false })).toBe(false);
    // Someone who is not the Admin can be demoted or disabled freely.
    expect(dropsAdmin(OFFICER, { role: 'member' })).toBe(false);
    expect(dropsAdmin(OFFICER, { disabled: true })).toBe(false);
  });

  it('another Admin cannot remove the last Admin: the UPDATE carries the EXISTS guard and a miss is 409', async () => {
    for (const patch of [{ siteAdmin: false }, { role: 'member' as const }, { disabled: true }]) {
      expect(await statusOf(updateUser(ADMIN_B, patch))).toBe(409);
      const { sql, params } = whereSql();
      expect(sql).toMatch(/exists \(select 1 from "app_users" as other where other\.id <> \$\d/);
      expect(sql).toContain('other.site_admin = true and other.disabled = false');
      expect(params).toEqual(['admin-b', 'admin-b']);
    }
  });

  it('other changes have no guard, and a missing account is 404', async () => {
    expect(await statusOf(updateUser(OFFICER, { role: 'member' }))).toBe(404);
    expect(whereSql().sql).not.toContain('exists');
    expect(await statusOf(updateUser(ADMIN_B, { title: 'Chair' }))).toBe(404);
    expect(whereSql().sql).not.toContain('exists');
  });
});
