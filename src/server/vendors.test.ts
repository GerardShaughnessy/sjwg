import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { HttpError } from './http';
import { assertUserPatchAllowed, userPatchSet } from './permissions';
import type { AppSession } from './auth/session';
import { userPatchSchema } from './schemas';

/** The database stand-in: records what the UPDATE writes, and serves the vendor list. */
const fake = vi.hoisted(() => ({
  set: null as unknown,
  rows: [] as unknown[],
  list: [] as unknown[],
}));
vi.mock('./db/client', () => ({
  db: () => ({
    update: () => ({
      set: (s: unknown) => {
        fake.set = s;
        return { where: () => ({ returning: async () => fake.rows }) };
      },
    }),
    select: () => ({
      from: () => ({
        leftJoin: () => ({ where: () => ({ orderBy: async () => fake.list }) }),
      }),
    }),
  }),
}));
const { updateUser } = await import('./db/queries/users');
const { GET: vendorsGET } = await import('../pages/api/users/vendors');
const { PATCH: userPATCH } = await import('../pages/api/users/[id]');

const ADMIN: AppSession = {
  userId: 'admin-1',
  authUserId: 'auth-1',
  email: 'admin@example.com',
  name: 'Ada Admin',
  role: 'admin',
  memberId: null,
  siteAdmin: true,
  title: '',
  director: false,
};
const OFFICER: AppSession = { ...ADMIN, userId: 'off-1', siteAdmin: false, title: 'Secretary' };
const DIRECTOR: AppSession = {
  ...ADMIN,
  userId: 'dir-1',
  role: 'member',
  siteAdmin: false,
  director: true,
};
const MEMBER: AppSession = { ...DIRECTOR, userId: 'mem-1', director: false };

const ctx = (session: AppSession | null, init?: RequestInit, params: Record<string, string> = {}) =>
  ({
    locals: { session },
    params,
    request: new Request('http://x/api/users/vendors', init),
  }) as unknown as APIContext;

function status(fn: () => unknown): number | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (err instanceof HttpError) return err.status;
    throw err;
  }
}

const userRow = (over: Record<string, unknown> = {}) => ({
  u: {
    id: 'v1',
    authUserId: 'auth-v1',
    email: 'web@example.com',
    name: 'Webb Studio',
    role: 'member',
    memberId: null,
    disabled: false,
    siteAdmin: false,
    title: '',
    director: false,
    boardTitle: '',
    vendor: true,
    vendorService: 'Website, design, and photography',
    lastLoginAt: null,
    createdAt: new Date(),
    ...over,
  },
  memberName: null,
  trade: null,
  privatePhone: null,
});

beforeEach(() => {
  fake.set = null;
  fake.rows = [];
  fake.list = [];
});

describe('vendor patch rules', () => {
  const tradesman = { id: 'mem-1', role: 'member' as const, disabled: false, vendor: false };

  it('the body takes vendor and a trimmed service of up to 120 characters', () => {
    expect(
      userPatchSchema.safeParse({ vendor: true, vendorService: '  Website and design ' }).data,
    ).toEqual({ vendor: true, vendorService: 'Website and design' });
    expect(userPatchSchema.safeParse({ vendorService: 'x'.repeat(120) }).success).toBe(true);
    expect(userPatchSchema.safeParse({ vendorService: 'x'.repeat(121) }).success).toBe(false);
    expect(userPatchSchema.safeParse({ vendor: 'yes' }).success).toBe(false);
  });

  it('a vendor needs an enabled account, not officer access', () => {
    expect(status(() => assertUserPatchAllowed(ADMIN, tradesman, { vendor: true }))).toBeNull();
    const off = { ...tradesman, disabled: true };
    expect(status(() => assertUserPatchAllowed(ADMIN, off, { vendor: true }))).toBe(400);
    expect(
      status(() => assertUserPatchAllowed(ADMIN, off, { vendor: true, disabled: false })),
    ).toBeNull();
    expect(
      status(() => assertUserPatchAllowed(ADMIN, tradesman, { vendor: true, disabled: true })),
    ).toBe(400);
  });

  it('a service needs vendor status; clearing it is always fine', () => {
    expect(
      status(() => assertUserPatchAllowed(ADMIN, tradesman, { vendorService: 'Printing' })),
    ).toBe(400);
    expect(
      status(() =>
        assertUserPatchAllowed(ADMIN, tradesman, { vendor: true, vendorService: 'Printing' }),
      ),
    ).toBeNull();
    const v = { ...tradesman, vendor: true };
    expect(
      status(() => assertUserPatchAllowed(ADMIN, v, { vendorService: 'Printing' })),
    ).toBeNull();
    expect(
      status(() => assertUserPatchAllowed(ADMIN, v, { vendor: false, vendorService: 'Printing' })),
    ).toBe(400);
    expect(
      status(() => assertUserPatchAllowed(ADMIN, tradesman, { vendorService: '' })),
    ).toBeNull();
  });

  it('the Admin can make themself a vendor', () => {
    const me = { id: ADMIN.userId, role: 'admin' as const, disabled: false, vendor: false };
    expect(status(() => assertUserPatchAllowed(ADMIN, me, { vendor: true }))).toBeNull();
  });
});

describe('what a vendor patch writes', () => {
  it('turning vendor off clears the service', async () => {
    expect(userPatchSet({ vendor: false })).toEqual({ vendor: false, vendorService: '' });
    const v = { id: 'v1', role: 'member' as const, siteAdmin: false, disabled: false };
    await updateUser(v, { vendor: false }).catch(() => {});
    expect(fake.set).toEqual({ vendor: false, vendorService: '' });
  });

  it('disabling an account clears vendor and service, as well as the board', () => {
    expect(userPatchSet({ disabled: true })).toEqual({
      disabled: true,
      director: false,
      boardTitle: '',
      vendor: false,
      vendorService: '',
    });
  });

  it('vendor status is independent of officer and board status', () => {
    const add = userPatchSet({ vendor: true, vendorService: 'Printing' });
    expect(add).toEqual({ vendor: true, vendorService: 'Printing' });
    const off = userPatchSet({ vendor: false });
    for (const k of ['role', 'title', 'siteAdmin', 'director', 'boardTitle'])
      expect(off).not.toHaveProperty(k);
    expect(userPatchSet({ role: 'member' })).not.toHaveProperty('vendor');
    expect(userPatchSet({ director: false })).not.toHaveProperty('vendor');
  });
});

describe('PATCH /api/users/[id] with vendor fields', () => {
  const patch = (s: AppSession | null, body: unknown) =>
    userPATCH(
      ctx(
        s,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
          headers: { 'content-type': 'application/json' },
        },
        { id: 'v1' },
      ),
    ) as Promise<Response>;

  it('only the Admin can change vendors', async () => {
    expect((await patch(OFFICER, { vendor: true })).status).toBe(403);
    expect((await patch(MEMBER, { vendor: true })).status).toBe(403);
    expect((await patch(null, { vendor: true })).status).toBe(401);
  });

  it('a service over 120 characters is refused', async () => {
    expect((await patch(ADMIN, { vendorService: 'x'.repeat(121) })).status).toBe(400);
  });
});

describe('who can read the vendors', () => {
  it('GET /api/users/vendors: Admin and officers 200; director and member 403; signed out 401', async () => {
    fake.list = [userRow(), userRow({ id: 'v2', disabled: true })];
    const call = (s: AppSession | null) => vendorsGET(ctx(s)) as Promise<Response>;
    const ok = await call(ADMIN);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      vendors: [
        {
          id: 'v1',
          name: 'Webb Studio',
          email: 'web@example.com',
          vendorService: 'Website, design, and photography',
          lastLoginAt: null,
        },
      ],
    });
    expect((await call(OFFICER)).status).toBe(200);
    expect((await call(DIRECTOR)).status).toBe(403);
    expect((await call(MEMBER)).status).toBe(403);
    expect((await call(null)).status).toBe(401);
  });
});
