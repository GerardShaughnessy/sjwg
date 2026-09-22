/**
 * THE faked backend. Every place a real server would attach is marked with a
 * `// BACKEND:` comment and listed in CONTENT-TODO.md. Reads are synchronous
 * (from localStorage). Writes return Promises after a simulated delay so
 * pending and confirmation states are real.
 *
 * Nothing here sends anything anywhere.
 */
import seedRequests from '@/data/seed/sample-requests.json';
import seedDonations from '@/data/seed/donations.json';
import { KEYS, getJSON, setJSON, removeKey } from './storage';
import { simulateLatency } from './delay';
import { makeId, makeRef } from './ids';
import { toCsv } from './csv';
import { slugify } from './trades';
import type {
  Donation,
  FormKind,
  FormSubmission,
  HelpRequest,
  Member,
  PostDraft,
  ReminderPrefs,
  RequestAnswers,
} from './types';

export { subscribe, getVersion } from './storage';

/* ------------------------------------------------------------ requests */
type RequestsBag = { seeded: number; items: HelpRequest[] };

function readRequests(): RequestsBag {
  const bag = getJSON<RequestsBag | null>(KEYS.requests, null);
  if (bag && bag.seeded === 1) return bag;
  const fresh: RequestsBag = { seeded: 1, items: seedRequests as HelpRequest[] };
  setJSON(KEYS.requests, fresh);
  return fresh;
}

function writeRequests(items: HelpRequest[]) {
  setJSON(KEYS.requests, { seeded: 1, items });
}

export const requests = {
  list(): HelpRequest[] {
    return [...readRequests().items].sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  },
  /** Requests submitted from this browser (the demo customer's "my requests"). */
  mine(): HelpRequest[] {
    return requests.list().filter((r) => r.owner === 'local');
  },
  // BACKEND: POST the request to an API, store it, and notify the Guild's intake
  // contact by email or text. The reference number should come from the server.
  async create(answers: RequestAnswers): Promise<HelpRequest> {
    await simulateLatency(700, 1300);
    const req: HelpRequest = {
      id: makeId('req'),
      ref: makeRef(),
      createdAt: new Date().toISOString(),
      status: 'open',
      trade: answers.trade,
      tradeSlug: answers.tradeSlug || slugify(answers.trade),
      description: answers.description.trim(),
      photoName: answers.photoName || undefined,
      urgency: answers.urgency || 'can-wait',
      zip: answers.zip.trim(),
      neighborhood: answers.neighborhood.trim(),
      contact: {
        name: answers.contact.name.trim(),
        phone: answers.contact.phone.trim(),
        email: answers.contact.email.trim(),
        bestTime: answers.contact.bestTime.trim(),
      },
      owner: 'local',
    };
    writeRequests([req, ...readRequests().items]);
    return req;
  },
  // BACKEND: status changes should be server-side and audited (who claimed, when).
  async update(id: string, patch: Partial<HelpRequest>): Promise<HelpRequest> {
    await simulateLatency(300, 600);
    const items = readRequests().items;
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Request not found.');
    const next = { ...items[idx], ...patch };
    items[idx] = next;
    writeRequests(items);
    return next;
  },
  claim(id: string, memberId: string) {
    return requests.update(id, { status: 'claimed', claimedBy: memberId });
  },
  refer(id: string, note: string) {
    return requests.update(id, { status: 'referred', notes: note });
  },
  close(id: string) {
    return requests.update(id, { status: 'closed' });
  },
  reopen(id: string) {
    return requests.update(id, { status: 'open', claimedBy: undefined });
  },
};

/* --------------------------------------------------------- request draft */
export const requestDraft = {
  get(): { step: number; answers: Partial<RequestAnswers> } | null {
    return getJSON(KEYS.requestDraft, null, 'session');
  },
  set(step: number, answers: Partial<RequestAnswers>) {
    setJSON(KEYS.requestDraft, { step, answers }, 'session');
  },
  clear() {
    removeKey(KEYS.requestDraft, 'session');
  },
};

/* --------------------------------------------------------------- posts */
export const posts = {
  list(): PostDraft[] {
    return getJSON<PostDraft[]>(KEYS.postDrafts, []).sort(
      (a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt),
    );
  },
  // BACKEND: a git-based CMS (Decap) or a small posts table. Publishing should
  // write a markdown file into src/content/blog and trigger a rebuild.
  async save(draft: Pick<PostDraft, 'title' | 'body'> & { id?: string }): Promise<PostDraft> {
    await simulateLatency();
    const now = new Date().toISOString();
    const all = getJSON<PostDraft[]>(KEYS.postDrafts, []);
    const existing = draft.id ? all.find((p) => p.id === draft.id) : undefined;
    const saved: PostDraft = existing
      ? { ...existing, title: draft.title, body: draft.body, updatedAt: now }
      : {
          id: makeId('post'),
          title: draft.title,
          body: draft.body,
          createdAt: now,
          updatedAt: now,
        };
    setJSON(
      KEYS.postDrafts,
      existing ? all.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...all],
    );
    return saved;
  },
  async remove(id: string): Promise<void> {
    await simulateLatency(200, 400);
    setJSON(
      KEYS.postDrafts,
      getJSON<PostDraft[]>(KEYS.postDrafts, []).filter((p) => p.id !== id),
    );
  },
};

/* ----------------------------------------------------------- reminders */
export const reminders = {
  get(): ReminderPrefs {
    return getJSON<ReminderPrefs>(KEYS.reminders, { email: false, sms: false, phone: '' });
  },
  // BACKEND: subscribe the member in an email provider (Buttondown, Mailchimp,
  // Resend) and an SMS provider (Twilio). Event reminders would be scheduled jobs.
  async save(prefs: ReminderPrefs): Promise<ReminderPrefs> {
    await simulateLatency();
    setJSON(KEYS.reminders, prefs);
    return prefs;
  },
};

/* ------------------------------------------------------------- profile */
type Overrides = Record<string, Partial<Member>>;

export const profile = {
  get(memberId: string, base: Member): Member {
    const o = getJSON<Overrides>(KEYS.profileOverrides, {});
    return { ...base, ...(o[memberId] ?? {}) };
  },
  // BACKEND: members table with the member editing only their own row; public
  // fields (phone, last name, exact area) are a consent question, see CONTENT-TODO.
  async update(memberId: string, patch: Partial<Member>): Promise<void> {
    await simulateLatency();
    const o = getJSON<Overrides>(KEYS.profileOverrides, {});
    o[memberId] = { ...(o[memberId] ?? {}), ...patch };
    setJSON(KEYS.profileOverrides, o);
  },
};

/* ----------------------------------------------------------- donations */
export const donations = {
  // BACKEND: donor records come from the payment processor (Stripe) or the donor
  // CRM (Eleo, Little Green Light) and sync to QuickBooks. See DONOR-SYSTEM-OPTIONS.md.
  list(): Donation[] {
    return [...(seedDonations as Donation[])].sort((a, b) => (a.date < b.date ? 1 : -1));
  },
  toCsv(): string {
    return toCsv(
      donations.list().map((d) => ({
        date: d.date,
        donor: d.donorName,
        amount: d.amount,
        method: d.method,
        fund: d.fund,
        tier: d.tier,
        recurring: d.recurring ? 'yes' : 'no',
      })),
    );
  },
};

/* --------------------------------------------------------------- forms */
export const forms = {
  list(): FormSubmission[] {
    return getJSON<FormSubmission[]>(KEYS.formSubmissions, []);
  },
  // BACKEND: Netlify Forms is the cheapest attach point for these three forms;
  // it emails the Guild and keeps a submissions log. No code change beyond the
  // form attributes would be needed for a static site.
  async submit(kind: FormKind, payload: Record<string, string>): Promise<FormSubmission> {
    await simulateLatency(600, 1100);
    const sub: FormSubmission = { id: makeId(kind), kind, payload, at: new Date().toISOString() };
    setJSON(KEYS.formSubmissions, [sub, ...forms.list()]);
    return sub;
  },
};
