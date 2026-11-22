import { describe, expect, it } from 'vitest';
import type { APIContext } from 'astro';
import { HttpError, requireRole, requireSiteAdmin } from './http';
import { assertCanInvite, assertUserPatchAllowed } from './permissions';
import { roleLabelFor, toAppSession, type AppSession, type AppUserRow } from './auth/session';
import { userPatchSchema } from './schemas';

const base: AppSession = {
  userId: 'admin-1',
  authUserId: 'auth-1',
  email: 'admin@example.com',
  name: 'Ada Admin',
  role: 'admin',
  memberId: null,
  siteAdmin: true,
  title: '',
};
const ADMIN = base;
const OFFICER: AppSession = { ...base, userId: 'off-1', siteAdmin: false, title: 'Secretary' };
const MEMBER: AppSession = { ...base, userId: 'mem-1', role: 'member', siteAdmin: false };

const ctx = (session: AppSession | null) => ({ locals: { session } }) as unknown as APIContext;

function status(fn: () => unknown): number | null {
  try {
    fn();
    return null;
  } catch (err) {
    if (err instanceof HttpError) return err.status;
    throw err;
  }
}

describe('Admin guards', () => {
  it('only the Admin passes requireSiteAdmin; an officer cannot PATCH users', () => {
    expect(requireSiteAdmin(ctx(ADMIN)).userId).toBe('admin-1');
    expect(status(() => requireSiteAdmin(ctx(OFFICER)))).toBe(403);
    expect(status(() => requireSiteAdmin(ctx(MEMBER)))).toBe(403);
    expect(status(() => requireSiteAdmin(ctx(null)))).toBe(401);
    // The flag means nothing without officer access.
    expect(status(() => requireSiteAdmin(ctx({ ...MEMBER, siteAdmin: true })))).toBe(403);
    // Officers keep everything else.
    expect(requireRole(ctx(OFFICER), 'admin').userId).toBe('off-1');
  });

  it('the Admin cannot remove their own Admin flag, disable, or demote themself', () => {
    const me = { id: ADMIN.userId, role: 'admin' as const };
    expect(status(() => assertUserPatchAllowed(ADMIN, me, { siteAdmin: false }))).toBe(400);
    expect(status(() => assertUserPatchAllowed(ADMIN, me, { disabled: true }))).toBe(400);
    expect(status(() => assertUserPatchAllowed(ADMIN, me, { role: 'member' }))).toBe(400);
    expect(status(() => assertUserPatchAllowed(ADMIN, me, { title: 'Chair' }))).toBeNull();
  });

  it('the Admin can change other people', () => {
    const other = { id: 'off-1', role: 'admin' as const };
    expect(status(() => assertUserPatchAllowed(ADMIN, other, { role: 'member' }))).toBeNull();
    expect(status(() => assertUserPatchAllowed(ADMIN, other, { disabled: true }))).toBeNull();
    expect(status(() => assertUserPatchAllowed(ADMIN, other, { siteAdmin: true }))).toBeNull();
    // Only an officer can be the Admin.
    const tradesman = { id: 'mem-1', role: 'member' as const };
    expect(status(() => assertUserPatchAllowed(ADMIN, tradesman, { siteAdmin: true }))).toBe(400);
    expect(
      status(() => assertUserPatchAllowed(ADMIN, tradesman, { siteAdmin: true, role: 'admin' })),
    ).toBeNull();
  });

  it('an officer cannot invite an officer, but can invite tradesmen', () => {
    expect(status(() => assertCanInvite(OFFICER, 'admin'))).toBe(403);
    expect(status(() => assertCanInvite(OFFICER, 'member'))).toBeNull();
    expect(status(() => assertCanInvite(ADMIN, 'admin'))).toBeNull();
  });

  it('the user patch body is strict', () => {
    expect(userPatchSchema.safeParse({ title: '  Vice President ' }).data).toEqual({
      title: 'Vice President',
    });
    expect(userPatchSchema.safeParse({}).success).toBe(false);
    expect(userPatchSchema.safeParse({ email: 'x@y.z' }).success).toBe(false);
    expect(userPatchSchema.safeParse({ role: 'owner' }).success).toBe(false);
  });
});

describe('sessions', () => {
  const row: AppUserRow = {
    id: 'u1',
    authUserId: 'a1',
    email: 'sam@example.com',
    name: 'Sam',
    role: 'admin',
    memberId: null,
    disabled: false,
    siteAdmin: true,
    title: 'Clerk',
  };
  it('a disabled user gets no session', () => {
    expect(toAppSession({ ...row, disabled: true }, {})).toBeNull();
    expect(toAppSession(undefined, {})).toBeNull();
  });
  it('carries the Admin flag and title, only for officers', () => {
    expect(toAppSession(row, {})).toMatchObject({ siteAdmin: true, title: 'Clerk' });
    expect(toAppSession({ ...row, role: 'member' }, {})).toMatchObject({
      siteAdmin: false,
      title: '',
    });
  });
  it('the header shows the title, then Admin, then Guild officer', () => {
    expect(roleLabelFor({ role: 'admin', siteAdmin: true, title: 'Vice President' })).toBe(
      'Vice President',
    );
    expect(roleLabelFor({ role: 'admin', siteAdmin: true, title: '' })).toBe('Admin');
    expect(roleLabelFor({ role: 'admin', siteAdmin: false, title: '' })).toBe('Guild officer');
    expect(roleLabelFor({ role: 'member', siteAdmin: false, title: '' }, 'Plumber')).toBe(
      'Plumber',
    );
  });
});
