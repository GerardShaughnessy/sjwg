import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import type { AppSession } from './auth/session';

/** The database stand-in: serves whatever app_users rows the test sets. */
const fake = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('./db/client', () => ({
  db: () => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({ where: () => ({ orderBy: async () => fake.rows }) }),
      }),
    }),
  }),
}));
const { listOfficers, listBoard } = await import('./db/queries/users');
const { GET: officersGET } = await import('../pages/api/users/officers');

const row = (id: string, over: Record<string, unknown> = {}) => ({
  u: {
    id,
    authUserId: `auth-${id}`,
    email: `${id}@example.com`,
    name: id,
    role: 'admin',
    memberId: null,
    disabled: false,
    siteAdmin: false,
    title: '',
    director: false,
    boardTitle: '',
    vendor: false,
    vendorService: '',
    lastLoginAt: null,
    createdAt: new Date(),
    ...over,
  },
  memberName: null,
  trade: null,
  privatePhone: null,
});

const OFFICER: AppSession = {
  userId: 'off-1',
  authUserId: 'auth-off-1',
  email: 'off@example.com',
  name: 'Otto Officer',
  role: 'admin',
  memberId: null,
  siteAdmin: false,
  title: 'Secretary',
  director: false,
};
const ctx = (session: AppSession | null) =>
  ({
    locals: { session },
    request: new Request('http://x/api/users/officers'),
  }) as unknown as APIContext;

beforeEach(() => {
  fake.rows = [
    row('the-admin', { siteAdmin: true, title: 'President' }),
    row('secretary', { title: 'Secretary' }),
    row('gone', { disabled: true }),
  ];
});

describe('the officers list leaves out the Admin', () => {
  it('listOfficers excludes a site_admin user and disabled officers', async () => {
    const ids = (await listOfficers()).map((u) => u.id);
    expect(ids).toEqual(['secretary']);
  });

  it('GET /api/users/officers excludes the Admin', async () => {
    const res = (await officersGET(ctx(OFFICER))) as Response;
    expect(res.status).toBe(200);
    const body = (await res.json()) as { officers: { id: string }[] };
    expect(body.officers.map((o) => o.id)).toEqual(['secretary']);
  });

  it('a tradesman cannot read the officers list', async () => {
    const res = (await officersGET(ctx({ ...OFFICER, role: 'member' }))) as Response;
    expect(res.status).toBe(403);
  });

  it('the Board page does not badge the Admin as an officer', async () => {
    fake.rows = [
      row('the-admin', { siteAdmin: true, director: true }),
      row('secretary', { director: true }),
    ];
    const board = await listBoard();
    expect(board.find((d) => d.id === 'the-admin')).toMatchObject({
      officer: false,
      officerTitle: '',
    });
    expect(board.find((d) => d.id === 'secretary')).toMatchObject({ officer: true });
  });
});
