import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('window', undefined);

const { ApiError, requests, posts, donations, invitations } = await import('./api');
const { getVersion } = await import('./storage');

const reply = (status: number, body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }),
  );

describe('api client', () => {
  beforeEach(() => fetchMock.mockReset());
  afterEach(() => fetchMock.mockReset());

  it('unwraps list responses', async () => {
    fetchMock.mockReturnValueOnce(reply(200, { requests: [{ id: 'a', ref: 'SJWG-ABC234' }] }));
    const list = await requests.list('open');
    expect(list[0].ref).toBe('SJWG-ABC234');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/requests?status=open');
  });

  it('turns server errors into ApiError with fields', async () => {
    fetchMock.mockReturnValueOnce(
      reply(400, {
        error: 'Give the post a title first.',
        fields: { title: 'Give the post a title first.' },
      }),
    );
    await expect(posts.save({ title: '', body: '' })).rejects.toMatchObject({
      status: 400,
      fields: { title: expect.any(String) },
    });
  });

  it('bumps the change bus on writes, not reads', async () => {
    const before = getVersion();
    fetchMock.mockReturnValueOnce(reply(200, { donations: [] }));
    await donations.list();
    expect(getVersion()).toBe(before);
    fetchMock.mockReturnValueOnce(reply(200, { id: 'r', status: 'claimed' }));
    await requests.claim('r');
    expect(getVersion()).toBe(before + 1);
  });

  it('sends JSON bodies with the right method', async () => {
    fetchMock.mockReturnValueOnce(
      reply(201, { id: 'i', email: 'a@b.co', emailed: false, mailError: null, link: '/invite/x' }),
    );
    await invitations.create({ email: 'a@b.co', name: 'A', role: 'member' });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).email).toBe('a@b.co');
  });

  it('reports network failure plainly', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await posts.list().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/Could not reach the Guild/);
  });
});
