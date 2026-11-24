import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { HttpError, requireBoardAccess } from './http';
import { assertUserPatchAllowed, userPatchSet } from './permissions';
import { toAppSession, type AppSession } from './auth/session';
import { userPatchSchema } from './schemas';

/** The database stand-in: records what the UPDATE writes, and serves the board list. */
const fake = vi.hoisted(() => ({ set: null as unknown, rows: [] as unknown[] }));
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
        leftJoin: () => ({ where: () => ({ orderBy: async () => [] }) }),
      }),
    }),
  }),
}));
const { updateUser, toBoardMember } = await import('./db/queries/users');
const { GET: boardGET } = await import('../pages/api/users/board');

const base: AppSession = {
  userId: 'admin-1',
  authUserId: 'auth-1',
  email: 'admin@example.com',
  name: 'Ada Admin',
  role: 'admin',
  memberId: null,
  siteAdmin: true,
  title: 'President',
  director: true,
};
const ADMIN = base;
const OFFICER: AppSession = { ...base, userId: 'off-1', siteAdmin: false, director: false };
const DIRECTOR: AppSession = {
  ...base,
  userId: 'dir-1',
  role: 'member',
  siteAdmin: false,
  title: '',
  director: true,
};
const MEMBER: AppSession = { ...DIRECTOR, userId: 'mem-1', director: false };

const ctx = (session: AppSession | null) =>
  ({
    locals: { session },
    request: new Request('http://x/api/users/board'),
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

beforeEach(() => {
  fake.set = null;
  fake.rows = [];
});

describe('board patch rules', () => {
  const tradesman = { id: 'mem-1', role: 'member' as const, disabled: false, director: false };

  it('the body takes director and a trimmed board title of up to 80 characters', () => {
    expect(userPatchSchema.safeParse({ director: true, boardTitle: '  Chair ' }).data).toEqual({
      director: true,
      boardTitle: 'Chair',
    });
    expect(userPatchSchema.safeParse({ boardTitle: 'x'.repeat(80) }).success).toBe(true);
    expect(userPatchSchema.safeParse({ boardTitle: 'x'.repeat(81) }).success).toBe(false);
    expect(userPatchSchema.safeParse({ director: 'yes' }).success).toBe(false);
  });

  it('a director need not be an officer, but needs an enabled account', () => {
    expect(status(() => assertUserPatchAllowed(ADMIN, tradesman, { director: true }))).toBeNull();
    const off = { ...tradesman, disabled: true };
    expect(status(() => assertUserPatchAllowed(ADMIN, off, { director: true }))).toBe(400);
    expect(
      status(() => assertUserPatchAllowed(ADMIN, off, { director: true, disabled: false })),
    ).toBeNull();
    expect(
      status(() => assertUserPatchAllowed(ADMIN, tradesman, { director: true, disabled: true })),
    ).toBe(400);
  });

  it('a board title needs board membership', () => {
    expect(status(() => assertUserPatchAllowed(ADMIN, tradesman, { boardTitle: 'Chair' }))).toBe(
      400,
    );
    expect(
      status(() =>
        assertUserPatchAllowed(ADMIN, tradesman, { director: true, boardTitle: 'Chair' }),
      ),
    ).toBeNull();
    const dir = { ...tradesman, director: true };
    expect(status(() => assertUserPatchAllowed(ADMIN, dir, { boardTitle: 'Chair' }))).toBeNull();
    expect(
      status(() => assertUserPatchAllowed(ADMIN, dir, { director: false, boardTitle: 'Chair' })),
    ).toBe(400);
    // Clearing a title is always fine.
    expect(status(() => assertUserPatchAllowed(ADMIN, tradesman, { boardTitle: '' }))).toBeNull();
  });

  it('the Admin can put themself on the board or take themself off', () => {
    const me = { id: ADMIN.userId, role: 'admin' as const, disabled: false, director: true };
    expect(status(() => assertUserPatchAllowed(ADMIN, me, { director: false }))).toBeNull();
  });
});

describe('officer access and board membership are separate', () => {
  it('turning director off clears the board title', async () => {
    expect(userPatchSet({ director: false })).toEqual({ director: false, boardTitle: '' });
    const dir = { id: 'dir-1', role: 'member' as const, siteAdmin: false, disabled: false };
    await updateUser(dir, { director: false }).catch(() => {});
    expect(fake.set).toEqual({ director: false, boardTitle: '' });
  });

  it('removing the officer role keeps director and board title', async () => {
    expect(userPatchSet({ role: 'member' })).toEqual({ role: 'member', siteAdmin: false });
    const officer = { id: 'off-1', role: 'admin' as const, siteAdmin: false, disabled: false };
    await updateUser(officer, { role: 'member' }).catch(() => {});
    expect(fake.set).not.toHaveProperty('director');
    expect(fake.set).not.toHaveProperty('boardTitle');
  });

  it('removing someone from the board keeps officer access and title', () => {
    const set = userPatchSet({ director: false });
    expect(set).not.toHaveProperty('role');
    expect(set).not.toHaveProperty('title');
    expect(set).not.toHaveProperty('siteAdmin');
  });

  it('the session carries director for officers and non-officers alike', () => {
    const row = {
      id: 'u1',
      authUserId: 'a1',
      email: 'd@example.com',
      name: 'Dee',
      role: 'member' as const,
      memberId: null,
      disabled: false,
      siteAdmin: false,
      title: '',
      director: true,
    };
    expect(toAppSession(row, {})).toMatchObject({ role: 'member', director: true });
    expect(toAppSession({ ...row, role: 'admin' }, {})).toMatchObject({ director: true });
    expect(toAppSession({ ...row, disabled: true }, {})).toBeNull();
  });
});

describe('the board list', () => {
  const view = {
    id: 'u1',
    name: 'Dee',
    email: 'd@example.com',
    role: 'admin' as const,
    title: 'Secretary',
    disabled: false,
    siteAdmin: false,
    director: true,
    boardTitle: 'Treasurer',
    lastLoginAt: null,
    member: { id: 'm1', name: 'Dee', trade: 'Plumber', privatePhone: '555-0100' },
  };
  it('shows the officer title only for officers, and the linked phone', () => {
    expect(toBoardMember(view)).toEqual({
      id: 'u1',
      name: 'Dee',
      email: 'd@example.com',
      boardTitle: 'Treasurer',
      officer: true,
      officerTitle: 'Secretary',
      phone: '555-0100',
      lastLoginAt: null,
    });
    expect(toBoardMember({ ...view, role: 'member', member: null })).toMatchObject({
      officer: false,
      officerTitle: '',
      phone: '',
    });
  });
});

describe('who can read the board', () => {
  it('officers and directors pass; a plain member is refused', () => {
    expect(status(() => requireBoardAccess(ctx(OFFICER)))).toBeNull();
    expect(status(() => requireBoardAccess(ctx(DIRECTOR)))).toBeNull();
    expect(status(() => requireBoardAccess(ctx(ADMIN)))).toBeNull();
    expect(status(() => requireBoardAccess(ctx(MEMBER)))).toBe(403);
    expect(status(() => requireBoardAccess(ctx(null)))).toBe(401);
  });

  it('GET /api/users/board: officer 200, director 200, member 403, signed out 401', async () => {
    const call = (s: AppSession | null) => boardGET(ctx(s)) as Promise<Response>;
    const ok = await call(OFFICER);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ board: [] });
    expect((await call(DIRECTOR)).status).toBe(200);
    expect((await call(MEMBER)).status).toBe(403);
    expect((await call(null)).status).toBe(401);
  });
});
