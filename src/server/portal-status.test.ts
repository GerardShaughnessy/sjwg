import { describe, expect, it } from 'vitest';
import {
  buildActivity,
  computeChecklist,
  docState,
  isReady,
  memberTodos,
  progressTotal,
  tradesmanStatus,
  type DocLite,
  type SignLite,
  TASK_FEED_MAX,
} from './portal-status';
import { taskEventText } from './task-rules';

const NOW = new Date('2026-11-21T18:00:00Z'); // Sat Nov 21, noon in St. Louis

const doc = (kind: string, status: string, extra: Partial<DocLite> = {}): DocLite => ({
  kind,
  status,
  expiresOn: null,
  note: '',
  createdAt: '2026-11-01T15:00:00Z',
  ...extra,
});
const sign = (status: string, extra: Partial<SignLite> = {}): SignLite => ({
  id: 'req-1',
  docKind: 'listing-packet',
  title: 'Directory Listing Packet',
  status,
  sentAt: '2026-11-18T15:00:00Z',
  viewedAt: null,
  signedAt: status === 'signed' ? '2026-11-19T15:00:00Z' : null,
  voidedAt: null,
  expiresAt: '2026-12-18T15:00:00Z',
  ...extra,
});
const allGood = [
  doc('baptism', 'verified'),
  doc('confirmation', 'verified'),
  doc('insurance', 'verified', { expiresOn: '2027-11-30' }),
];
const tones = (items: { key: string; tone: string }[]) =>
  Object.fromEntries(items.map((i) => [i.key, i.tone]));

describe('listing checklist', () => {
  it('is all done for a signed packet and verified papers, license optional', () => {
    const c = computeChecklist(allGood, [sign('signed')], NOW);
    expect(tones(c)).toEqual({
      paperwork: 'done',
      baptism: 'done',
      confirmation: 'done',
      insurance: 'done',
      license: 'neutral',
    });
    expect(c[0].detail).toBe('Signed Nov 19');
    expect(isReady(c)).toBe(true);
  });

  it('shows review, rejection, expiry, and a missing paper', () => {
    const c = computeChecklist(
      [
        doc('baptism', 'pending'),
        doc('confirmation', 'rejected', { note: 'Blurry photo' }),
        doc('license', 'verified', { expiresOn: '2026-10-01' }),
      ],
      [],
      NOW,
    );
    expect(tones(c)).toEqual({
      paperwork: 'attention',
      baptism: 'waiting',
      confirmation: 'attention',
      insurance: 'neutral',
      license: 'attention',
    });
    expect(c.find((i) => i.key === 'license')?.detail).toBe('Expired');
    expect(isReady(c)).toBe(false);
  });

  it('flags insurance that expires within 30 days, but not a renewal already uploaded', () => {
    const soon = doc('insurance', 'verified', { expiresOn: '2026-12-02' });
    expect(docState([soon], 'insurance', NOW)).toMatchObject({ state: 'verified', soon: true });
    const c = computeChecklist([soon], [], NOW);
    expect(c.find((i) => i.key === 'insurance')).toMatchObject({
      tone: 'attention',
      detail: 'Expires Dec 2',
    });
    const renewal = doc('insurance', 'pending', { createdAt: '2026-11-20T15:00:00Z' });
    expect(docState([soon, renewal], 'insurance', NOW).state).toBe('pending');
  });

  it('a verified copy outranks an older rejected one', () => {
    const s = docState(
      [
        doc('baptism', 'rejected', { createdAt: '2026-10-01T00:00:00Z' }),
        doc('baptism', 'verified'),
      ],
      'baptism',
      NOW,
    );
    expect(s.state).toBe('verified');
  });

  it('ignores voided paperwork and marks an expired link', () => {
    expect(computeChecklist([], [sign('voided')], NOW)[0].detail).toBe('Not sent yet');
    const expired = sign('sent', { expiresAt: '2026-11-01T00:00:00Z' });
    expect(computeChecklist([], [expired], NOW)[0]).toMatchObject({
      tone: 'attention',
      detail: 'Link expired',
    });
    expect(computeChecklist([], [sign('viewed')], NOW)[0]).toMatchObject({
      tone: 'waiting',
      detail: 'Opened, not signed',
    });
  });
});

describe('listing paperwork and progress', () => {
  it('counts a standalone pledge only when the waiver and agreement are signed too', () => {
    const one = (docKind: string, id: string) => sign('signed', { docKind, id, title: docKind });
    expect(computeChecklist([], [one('ethical-pledge', 'p')], NOW)[0].tone).not.toBe('done');
    const all = [
      one('ethical-pledge', 'p'),
      one('tradesman-waiver', 'w'),
      one('tradesman-agreement', 'a'),
    ];
    expect(computeChecklist([], all, NOW)[0].tone).toBe('done');
  });

  it('counts the license toward progress only once one is uploaded', () => {
    const c = computeChecklist(allGood, [sign('signed')], NOW);
    expect(progressTotal(c)).toBe(4);
    const withLicense = computeChecklist(
      [...allGood, doc('license', 'pending')],
      [sign('signed')],
      NOW,
    );
    expect(progressTotal(withLicense)).toBe(5);
  });

  it('expires by St. Louis date: good through the end of the printed day', () => {
    const today = doc('insurance', 'verified', { expiresOn: '2026-11-21' });
    // 11:30 PM Nov 21 in St. Louis is already Nov 22 in UTC.
    const lateNight = new Date('2026-11-22T05:30:00Z');
    expect(docState([today], 'insurance', lateNight).state).toBe('verified');
    // 12:30 AM Nov 22 in St. Louis.
    expect(docState([today], 'insurance', new Date('2026-11-22T06:30:00Z')).state).toBe('expired');
    const edge = doc('insurance', 'verified', { expiresOn: '2026-12-21' });
    expect(docState([edge], 'insurance', NOW)).toMatchObject({ soon: true });
    const later = doc('insurance', 'verified', { expiresOn: '2026-12-22' });
    expect(docState([later], 'insurance', NOW)).toMatchObject({ soon: false });
  });
});

describe('officer status for a tradesman', () => {
  it('is Ready with nothing to do', () => {
    const s = tradesmanStatus({ docs: allGood, signs: [sign('signed')], listed: true, now: NOW });
    expect(s).toMatchObject({ note: 'Ready', tone: 'done', needsAction: false, done: 4 });
    expect(
      tradesmanStatus({ docs: allGood, signs: [sign('signed')], listed: false, now: NOW }).note,
    ).toBe('Ready, not listed');
  });

  it('puts documents to review first and needs action', () => {
    const s = tradesmanStatus({
      docs: [...allGood.slice(0, 2), doc('insurance', 'pending')],
      signs: [sign('signed')],
      listed: true,
      now: NOW,
    });
    expect(s).toMatchObject({ note: 'Insurance to review', needsAction: true, tone: 'waiting' });
  });

  it('says Invited for someone with an open invitation and nothing else', () => {
    const s = tradesmanStatus({ docs: [], signs: [], listed: false, invited: true, now: NOW });
    expect(s.note).toBe('Invited');
    expect(s.needsAction).toBe(true);
  });

  it('paperwork sent recently is waiting on him, not on an officer', () => {
    const s = tradesmanStatus({ docs: allGood, signs: [sign('sent')], listed: false, now: NOW });
    expect(s).toMatchObject({ note: 'Paperwork not signed', needsAction: false });
    const stale = tradesmanStatus({
      docs: allGood,
      signs: [sign('sent', { sentAt: '2026-11-05T15:00:00Z' })],
      listed: false,
      now: NOW,
    });
    expect(stale.needsAction).toBe(true);
  });

  it('notes insurance about to expire', () => {
    const s = tradesmanStatus({
      docs: [...allGood.slice(0, 2), doc('insurance', 'verified', { expiresOn: '2026-12-02' })],
      signs: [sign('signed')],
      listed: true,
      now: NOW,
    });
    expect(s).toMatchObject({ note: 'Insurance expires Dec 2', needsAction: true });
  });
});

describe('tradesman to-do list', () => {
  it('lists signing, uploads, a rejection, and the listing', () => {
    const todos = memberTodos({
      docs: [doc('baptism', 'verified'), doc('confirmation', 'rejected', { note: 'Unreadable' })],
      signs: [sign('sent')],
      listed: false,
      now: NOW,
    });
    expect(todos.map((t) => t.title)).toEqual([
      'Sign your listing paperwork',
      'A document was rejected: Unreadable',
      'Upload your proof of insurance',
      'Your directory entry is not listed yet',
    ]);
    expect(todos[0].href).toBe('/sign/request/req-1');
  });

  it('warns about insurance expiring within 30 days and is empty when all is well', () => {
    const todos = memberTodos({
      docs: [...allGood.slice(0, 2), doc('insurance', 'verified', { expiresOn: '2026-12-02' })],
      signs: [sign('signed')],
      listed: true,
      now: NOW,
    });
    expect(todos.map((t) => t.title)).toEqual(['Insurance expires on Dec 2, 2026']);
    expect(memberTodos({ docs: allGood, signs: [sign('signed')], listed: true, now: NOW })).toEqual(
      [],
    );
  });

  it('still offers Sign now for an expired link, and hides an older open request', () => {
    const old = sign('sent', {
      id: 'old',
      sentAt: '2026-10-01T15:00:00Z',
      expiresAt: '2026-10-31T15:00:00Z',
    });
    const todos = memberTodos({ docs: allGood, signs: [old], listed: true, now: NOW });
    expect(todos).toHaveLength(1);
    expect(todos[0]).toMatchObject({ action: 'Sign now', href: '/sign/request/old' });
    const both = memberTodos({
      docs: allGood,
      signs: [old, sign('sent', { id: 'new' })],
      listed: true,
      now: NOW,
    });
    expect(both.map((t) => t.href)).toEqual(['/sign/request/new']);
  });

  it('never uses an em dash', () => {
    const todos = memberTodos({ docs: [], signs: [sign('sent')], listed: false, now: NOW });
    expect(JSON.stringify(todos)).not.toMatch(/—/);
  });
});

describe('activity feed', () => {
  it('merges, sorts newest first, and counts affirmations without names', () => {
    const feed = buildActivity(
      {
        aid: [
          { id: 'a1', at: '2026-11-21T15:12:00Z', who: 'St. Agatha Parish', urgency: 'emergency' },
        ],
        uploads: [{ at: '2026-11-21T14:40:00Z', name: 'Sam Naumann', kind: 'insurance' }],
        signed: [
          { at: '2026-11-20T20:00:00Z', name: 'Joe Gibbons', title: 'Directory Listing Packet' },
        ],
        affirmations: [
          { at: '2026-11-20T15:00:00Z' },
          { at: '2026-11-20T16:00:00Z' },
          { at: '2026-11-20T17:00:00Z' },
        ],
        rsvps: [{ at: '2026-11-18T17:00:00Z' }, { at: '2026-11-18T18:00:00Z' }],
      },
      NOW,
    );
    expect(feed.map((f) => f.text)).toEqual([
      'St. Agatha Parish applied for help (emergency).',
      'Sam Naumann uploaded proof of insurance.',
      'Joe Gibbons signed the listing packet.',
      '3 people affirmed the directory terms yesterday.',
      '2 new RSVPs came in.',
    ]);
    expect(feed[0]).toMatchObject({ when: 'Today, 9:12 AM', tab: 'aid', query: 'aid=a1' });
    expect(feed[3].when).toBe('Yesterday');
    expect(feed[4].when).toBe('Nov 18');
  });

  it('keeps only the newest items', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({
      at: new Date(NOW.getTime() - i * 60000).toISOString(),
      name: `Person ${i}`,
      kind: 'baptism',
    }));
    const feed = buildActivity(
      { aid: [], uploads: many, signed: [], affirmations: [], rsvps: [] },
      NOW,
    );
    expect(feed).toHaveLength(12);
    expect(feed[0].text).toBe('Person 0 uploaded a baptism certificate.');
  });

  it('task events take at most five slots, so help requests and uploads stay', () => {
    const at = (i: number) => new Date(NOW.getTime() - i * 60000).toISOString();
    const tasks = Array.from({ length: 12 }, (_, i) => ({
      at: at(i),
      text: `Task line ${i}.`,
      taskId: `t${i}`,
    }));
    const feed = buildActivity(
      {
        aid: [{ id: 'a1', at: at(30), who: 'St. Agatha Parish', urgency: 'normal' }],
        uploads: [{ at: at(31), name: 'Sam Naumann', kind: 'insurance' }],
        signed: [],
        affirmations: [],
        rsvps: [],
        tasks,
      },
      NOW,
    );
    expect(feed.filter((f) => f.tab === 'tasks')).toHaveLength(TASK_FEED_MAX);
    expect(TASK_FEED_MAX).toBe(5);
    expect(feed[0].text).toBe('Task line 0.');
    expect(feed.map((f) => f.text)).toContain('St. Agatha Parish applied for help.');
    expect(feed.map((f) => f.text)).toContain('Sam Naumann uploaded proof of insurance.');
  });

  it('an event from a deleted task reads from its stored title, without a link', () => {
    const text = taskEventText({
      type: 'moved',
      actorName: 'Greg',
      toStatus: 'doing',
      meta: { title: 'Order shirts' },
    });
    const [item] = buildActivity(
      {
        aid: [],
        uploads: [],
        signed: [],
        affirmations: [],
        rsvps: [],
        tasks: [{ at: NOW.toISOString(), text: text!, taskId: null }],
      },
      NOW,
    );
    expect(item.text).toBe("Greg moved 'Order shirts' to In progress.");
    expect(item).not.toHaveProperty('query');
  });
});
