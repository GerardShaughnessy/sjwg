import { describe, it, expect, beforeEach, vi } from 'vitest';

function memStorage(): Storage {
  let m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

vi.stubGlobal('window', {
  localStorage: memStorage(),
  sessionStorage: memStorage(),
  addEventListener: () => {},
});
vi.stubGlobal('document', {});
vi.mock('./delay', () => ({ simulateLatency: () => Promise.resolve() }));

const { requests, posts, forms, donations } = await import('./store');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('requests', () => {
  it('seeds sample requests once and lists newest first', () => {
    const list = requests.list();
    expect(list.length).toBe(4);
    expect(+new Date(list[0].createdAt)).toBeGreaterThan(+new Date(list[3].createdAt));
  });
  it('creates a local request with a reference and shows it in mine()', async () => {
    const r = await requests.create({
      trade: 'Plumbing',
      tradeSlug: 'plumbing',
      description: 'Leak under sink',
      photoName: '',
      urgency: 'getting-worse',
      zip: '63118',
      neighborhood: '',
      contact: { name: 'Test', phone: '3145550100', email: '', bestTime: '' },
    });
    expect(r.ref).toMatch(/^SJWG-/);
    expect(requests.mine()).toHaveLength(1);
    expect(requests.list()[0].id).toBe(r.id);
  });
  it('claims and refers', async () => {
    const id = requests.list()[0].id;
    await requests.claim(id, 'm-01');
    expect(requests.list().find((r) => r.id === id)?.status).toBe('claimed');
    await requests.refer(id, 'sent to Sam');
    expect(requests.list().find((r) => r.id === id)?.notes).toBe('sent to Sam');
  });
});

describe('posts, forms, donations', () => {
  it('saves and updates drafts', async () => {
    const a = await posts.save({ title: 'One', body: 'x' });
    await posts.save({ id: a.id, title: 'One edited', body: 'y' });
    expect(posts.list()).toHaveLength(1);
    expect(posts.list()[0].title).toBe('One edited');
    await posts.remove(a.id);
    expect(posts.list()).toHaveLength(0);
  });
  it('records form submissions', async () => {
    await forms.submit('contact', { name: 'A' });
    expect(forms.list()[0].kind).toBe('contact');
  });
  it('exports donations as CSV with a header', () => {
    expect(donations.toCsv().split('\r\n')[0]).toBe('date,donor,amount,method,fund,tier,recurring');
    expect(donations.list().length).toBe(12);
  });
});
