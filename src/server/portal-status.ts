/**
 * Pure portal status logic: a tradesman's listing checklist, the short note
 * officers see beside his name, whether an officer needs to act, his own
 * to-do list, and the officer activity feed. No database, no clock: callers
 * pass `now`, so this is easy to test.
 */

export type Tone = 'done' | 'waiting' | 'attention' | 'neutral';

export interface DocLite {
  id?: string;
  kind: string;
  status: string;
  expiresOn: string | null;
  note?: string;
  createdAt: string;
}

export interface SignLite {
  id: string;
  docKind: string;
  title: string;
  status: string;
  sentAt: string;
  viewedAt?: string | null;
  signedAt: string | null;
  voidedAt?: string | null;
  expiresAt: string;
}

export type ChecklistKey = 'paperwork' | 'baptism' | 'confirmation' | 'insurance' | 'license';

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  tone: Tone;
  /** Short words for the badge: "Signed Nov 22", "To review", "Expires Dec 2". */
  detail: string;
}

export interface Todo {
  id: string;
  title: string;
  detail: string;
  /** Where the button goes: a URL, or a portal tab id. */
  href?: string;
  tab?: string;
  action: string;
  tone: Tone;
}

const DAY = 24 * 3600 * 1000;
export const SOON_DAYS = 30;
export const STALE_DAYS = 7;

/** Kinds of signed paperwork that count toward the listing. */
export const LISTING_SIGN_KINDS = ['listing-packet', 'ethical-pledge'];

const DOC_LABEL: Record<string, string> = {
  baptism: 'Baptism certificate',
  confirmation: 'Confirmation certificate',
  insurance: 'Proof of insurance',
  license: 'Trade license',
};
const CHECK_LABEL: Record<ChecklistKey, string> = {
  paperwork: 'Ethical Pledge, waiver, and agreement',
  ...(DOC_LABEL as Record<Exclude<ChecklistKey, 'paperwork'>, string>),
};
const REQUIRED_DOCS = ['baptism', 'confirmation', 'insurance'] as const;
const DOC_KEYS = [...REQUIRED_DOCS, 'license'] as const;

/** "Dec 2" from a plain date or an ISO time, in St. Louis time for times. */
export function shortDay(d: string, withYear = false): string {
  const plain = /^\d{4}-\d{2}-\d{2}$/.test(d);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: plain ? 'UTC' : 'America/Chicago',
  }).format(new Date(plain ? `${d}T12:00:00Z` : d));
}

/** End of the printed expiry day, so a policy is good through that date. */
const expiryTime = (d: string) => Date.parse(`${d}T23:59:59Z`);

export function isExpired(d: DocLite, now: Date): boolean {
  return Boolean(d.expiresOn) && expiryTime(d.expiresOn!) < now.getTime();
}
export function expiresSoon(d: DocLite, now: Date): boolean {
  return (
    Boolean(d.expiresOn) &&
    !isExpired(d, now) &&
    expiryTime(d.expiresOn!) - now.getTime() <= SOON_DAYS * DAY
  );
}

const newestFirst = <T extends { createdAt: string }>(a: T, b: T) =>
  Date.parse(b.createdAt) - Date.parse(a.createdAt);

export type DocState =
  | { state: 'verified'; doc: DocLite; soon: boolean }
  | { state: 'pending'; doc: DocLite }
  | { state: 'rejected'; doc: DocLite }
  | { state: 'expired'; doc: DocLite }
  | { state: 'missing' };

/**
 * Where one kind of document stands. A good verified copy wins; a newer
 * upload waiting for review comes next; then the latest rejection or an
 * expired copy, so the tradesman knows what to fix.
 */
export function docState(docs: DocLite[], kind: string, now: Date): DocState {
  const mine = docs.filter((d) => d.kind === kind).sort(newestFirst);
  const good = mine.find((d) => d.status === 'verified' && !isExpired(d, now));
  const pending = mine.find((d) => d.status === 'pending');
  if (good && !(pending && good.expiresOn && expiresSoon(good, now)))
    return { state: 'verified', doc: good, soon: expiresSoon(good, now) };
  if (pending) return { state: 'pending', doc: pending };
  const latest = mine[0];
  if (!latest) return { state: 'missing' };
  if (latest.status === 'rejected') return { state: 'rejected', doc: latest };
  return { state: 'expired', doc: mine.find((d) => d.status === 'verified') ?? latest };
}

export type PaperState =
  | { state: 'signed'; req: SignLite }
  | { state: 'open'; req: SignLite; expired: boolean; stale: boolean }
  | { state: 'none' };

/** The listing paperwork: signed, out for signature, or not sent yet. Voided requests do not count. */
export function paperState(signs: SignLite[], now: Date): PaperState {
  const live = signs
    .filter((s) => LISTING_SIGN_KINDS.includes(s.docKind) && s.status !== 'voided' && !s.voidedAt)
    .sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
  const signed = live.find((s) => s.status === 'signed');
  if (signed) return { state: 'signed', req: signed };
  const open = live.find((s) => s.status === 'sent' || s.status === 'viewed');
  if (open)
    return {
      state: 'open',
      req: open,
      expired: Date.parse(open.expiresAt) < now.getTime(),
      stale: now.getTime() - Date.parse(open.sentAt) > STALE_DAYS * DAY,
    };
  return { state: 'none' };
}

export function computeChecklist(docs: DocLite[], signs: SignLite[], now: Date): ChecklistItem[] {
  const p = paperState(signs, now);
  const paper: ChecklistItem = {
    key: 'paperwork',
    label: CHECK_LABEL.paperwork,
    ...(p.state === 'signed'
      ? { tone: 'done', detail: `Signed ${shortDay(p.req.signedAt ?? p.req.sentAt)}` }
      : p.state === 'open'
        ? p.expired
          ? { tone: 'attention', detail: 'Link expired' }
          : {
              tone: 'waiting',
              detail:
                p.req.viewedAt || p.req.status === 'viewed'
                  ? 'Opened, not signed'
                  : 'Sent, not signed',
            }
        : { tone: 'attention', detail: 'Not sent yet' }),
  };
  const items = DOC_KEYS.map((key): ChecklistItem => {
    const s = docState(docs, key, now);
    const base = { key, label: CHECK_LABEL[key] };
    switch (s.state) {
      case 'verified':
        return s.soon
          ? { ...base, tone: 'attention', detail: `Expires ${shortDay(s.doc.expiresOn!)}` }
          : { ...base, tone: 'done', detail: 'Done' };
      case 'pending':
        return { ...base, tone: 'waiting', detail: 'Being reviewed' };
      case 'rejected':
        return { ...base, tone: 'attention', detail: 'Not accepted' };
      case 'expired':
        return { ...base, tone: 'attention', detail: 'Expired' };
      default:
        return key === 'license'
          ? { ...base, tone: 'neutral', detail: 'If your trade needs one' }
          : { ...base, tone: 'neutral', detail: 'Not uploaded' };
    }
  });
  return [paper, ...items];
}

export const doneCount = (items: ChecklistItem[]) => items.filter((i) => i.tone === 'done').length;

/** Paperwork, Baptism, Confirmation, and insurance done, and nothing waiting or wrong. */
export function isReady(items: ChecklistItem[]): boolean {
  const need: ChecklistKey[] = ['paperwork', 'baptism', 'confirmation', 'insurance'];
  return (
    need.every((k) => items.find((i) => i.key === k)?.tone === 'done') &&
    !items.some((i) => i.tone === 'attention' || i.tone === 'waiting')
  );
}

/** The colour of the dot beside his name. */
export function overallTone(items: ChecklistItem[]): Tone {
  if (items.some((i) => i.tone === 'attention')) return 'attention';
  if (items.some((i) => i.tone === 'waiting')) return 'waiting';
  return isReady(items) ? 'done' : 'neutral';
}

export interface TradesmanStatus {
  checklist: ChecklistItem[];
  done: number;
  tone: Tone;
  note: string;
  needsAction: boolean;
  pendingDocs: number;
}

/**
 * Everything an officer needs to sort the roster. Needs action means an
 * officer has something to do: a document to review, paperwork to send or
 * re-send, or a document that was rejected, expired, or is about to.
 */
export function tradesmanStatus(input: {
  docs: DocLite[];
  signs: SignLite[];
  listed: boolean;
  invited?: boolean;
  now: Date;
}): TradesmanStatus {
  const { docs, signs, listed, invited = false, now } = input;
  const checklist = computeChecklist(docs, signs, now);
  const pending = docs.filter((d) => d.status === 'pending');
  const paper = paperState(signs, now);
  const byKey = (k: ChecklistKey) => checklist.find((i) => i.key === k)!;
  const docItems = checklist.filter((i) => i.key !== 'paperwork');
  const pendingTypes = [...new Set(pending.map((d) => d.kind))];

  let note: string;
  if (pending.length === 1) note = `${shortLabel(pending[0].kind)} to review`;
  else if (pending.length > 1)
    note =
      pendingTypes.length === 1
        ? `${pending.length} ${shortLabel(pendingTypes[0]).toLowerCase()} files to review`
        : `${pending.length} documents to review`;
  else if (paper.state === 'none' && docs.length === 0 && signs.length === 0 && invited)
    note = 'Invited';
  else if (paper.state === 'open' && paper.expired) note = 'Signing link expired';
  else if (paper.state === 'none') note = 'Paperwork not sent';
  else if (paper.state === 'open') note = 'Paperwork not signed';
  else {
    const rejected = docItems.find((i) => i.detail === 'Not accepted');
    const expired = docItems.find((i) => i.detail === 'Expired');
    const soon = docItems.find((i) => i.detail.startsWith('Expires '));
    const missing = REQUIRED_DOCS.filter((k) => byKey(k).tone === 'neutral');
    if (rejected) note = `${shortLabel(rejected.key)} not accepted`;
    else if (expired) note = `${shortLabel(expired.key)} expired`;
    else if (soon) note = `${shortLabel(soon.key)} ${lowerFirst(soon.detail)}`;
    else if (missing.length === 1) note = `Needs ${shortLabel(missing[0]).toLowerCase()}`;
    else if (missing.length > 1) note = `Needs ${missing.length} documents`;
    else note = listed ? 'Ready' : 'Ready, not listed';
  }

  const needsAction =
    pending.length > 0 ||
    paper.state === 'none' ||
    (paper.state === 'open' && (paper.expired || paper.stale)) ||
    docItems.some((i) => i.tone === 'attention');

  return {
    checklist,
    done: doneCount(checklist),
    tone: overallTone(checklist),
    note,
    needsAction,
    pendingDocs: pending.length,
  };
}

function shortLabel(kind: string): string {
  return (
    {
      baptism: 'Baptism',
      confirmation: 'Confirmation',
      insurance: 'Insurance',
      license: 'License',
    }[kind] ?? 'Document'
  );
}

/** What the tradesman should do next, most urgent first. */
export function memberTodos(input: {
  docs: DocLite[];
  signs: SignLite[];
  listed: boolean;
  now: Date;
}): Todo[] {
  const { docs, signs, listed, now } = input;
  const out: Todo[] = [];
  const open = signs.filter((s) => (s.status === 'sent' || s.status === 'viewed') && !s.voidedAt);
  for (const s of open) {
    const expired = Date.parse(s.expiresAt) < now.getTime();
    out.push(
      expired
        ? {
            id: `sign-${s.id}`,
            title: `Your signing link for the ${s.title} expired`,
            detail: 'Ask a Guild officer to send a new one.',
            action: '',
            tone: 'attention',
          }
        : {
            id: `sign-${s.id}`,
            title: LISTING_SIGN_KINDS.includes(s.docKind)
              ? 'Sign your listing paperwork'
              : `Sign the ${s.title}`,
            detail: `Sent ${shortDay(s.sentAt)}. It takes about ten minutes to read and sign.`,
            href: `/sign/request/${s.id}`,
            action: 'Sign now',
            tone: 'attention',
          },
    );
  }
  for (const kind of DOC_KEYS) {
    const s = docState(docs, kind, now);
    const label = DOC_LABEL[kind];
    const lower = label.charAt(0).toLowerCase() + label.slice(1);
    if (s.state === 'rejected')
      out.push({
        id: `doc-${kind}`,
        title: `A document was rejected: ${s.doc.note || label}`,
        detail: `Upload a new copy of your ${lower}.`,
        tab: 'listing',
        action: 'Upload',
        tone: 'attention',
      });
    else if (s.state === 'expired')
      out.push({
        id: `doc-${kind}`,
        title: `Your ${lower} expired on ${shortDay(s.doc.expiresOn ?? s.doc.createdAt, true)}`,
        detail: 'Upload the current one.',
        tab: 'listing',
        action: 'Upload',
        tone: 'attention',
      });
    else if (s.state === 'verified' && s.soon)
      out.push({
        id: `doc-${kind}`,
        title: `${kind === 'insurance' ? 'Insurance' : label} expires on ${shortDay(s.doc.expiresOn!, true)}`,
        detail: 'Upload the renewed one when you have it.',
        tab: 'listing',
        action: 'Upload',
        tone: 'waiting',
      });
    else if (s.state === 'missing' && (REQUIRED_DOCS as readonly string[]).includes(kind))
      out.push({
        id: `doc-${kind}`,
        title: `Upload your ${lower}`,
        detail: 'Needed before your listing goes live.',
        tab: 'listing',
        action: 'Upload',
        tone: 'neutral',
      });
  }
  if (!listed)
    out.push({
      id: 'listed',
      title: 'Your directory entry is not listed yet',
      detail: 'Check your entry and tick the box when you are ready to be listed.',
      tab: 'listing',
      action: 'Edit entry',
      tone: 'neutral',
    });
  return out;
}

/* ---------------------------------------------------------------- activity */

export interface ActivityItem {
  at: string;
  /** Today, 9:12 AM / Yesterday / Nov 20 */
  when: string;
  text: string;
  /** Where clicking it goes, as a portal tab id and optional query. */
  tab?: string;
  query?: string;
}

export interface ActivityInput {
  aid: { id: string; at: string; who: string; urgency: string }[];
  uploads: { at: string; name: string; kind: string }[];
  signed: { at: string; name: string; title: string }[];
  affirmations: { at: string }[];
  rsvps: { at: string }[];
}

const TZ = 'America/Chicago';
const dayKey = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));

/** "Today, 9:12 AM", "Yesterday, 4:05 PM", or "Nov 20" in St. Louis time. */
export function whenLabel(iso: string, now: Date, withTime = true): string {
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - DAY).toISOString());
  const k = dayKey(iso);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
  if (k === today) return withTime ? `Today, ${time}` : 'Today';
  if (k === yesterday) return withTime ? `Yesterday, ${time}` : 'Yesterday';
  return shortDay(iso);
}

/** Group times by St. Louis day: [{ day, count, latest }], newest day first. */
function byDay(rows: { at: string }[]): { count: number; latest: string }[] {
  const m = new Map<string, { count: number; latest: string }>();
  for (const r of rows) {
    const k = dayKey(r.at);
    const cur = m.get(k);
    if (!cur) m.set(k, { count: 1, latest: r.at });
    else {
      cur.count++;
      if (r.at > cur.latest) cur.latest = r.at;
    }
  }
  return [...m.values()].sort((a, b) => b.latest.localeCompare(a.latest));
}

const UPLOAD_PHRASE: Record<string, string> = {
  baptism: 'a baptism certificate',
  confirmation: 'a confirmation certificate',
  insurance: 'proof of insurance',
  license: 'a trade license',
  w9: 'a W-9',
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * The officer dashboard feed. Directory affirmations and RSVPs are counted
 * per day and never name anyone.
 */
export function buildActivity(input: ActivityInput, now: Date, limit = 10): ActivityItem[] {
  const items: ActivityItem[] = [
    ...input.aid.map((a) => ({
      at: a.at,
      when: whenLabel(a.at, now),
      text: `${a.who} applied for help${a.urgency === 'emergency' ? ' (emergency)' : ''}.`,
      tab: 'aid',
      query: `aid=${a.id}`,
    })),
    ...input.uploads.map((u) => ({
      at: u.at,
      when: whenLabel(u.at, now),
      text: `${u.name} uploaded ${UPLOAD_PHRASE[u.kind] ?? 'a document'}.`,
      tab: 'tradesmen',
    })),
    ...input.signed.map((s) => ({
      at: s.at,
      when: whenLabel(s.at, now),
      text: `${s.name} signed the ${s.title.replace(/^Directory Listing Packet$/, 'listing packet')}.`,
      tab: 'tradesmen',
    })),
    ...byDay(input.affirmations).map((g) => {
      const day = whenLabel(g.latest, now, false);
      const rel = day === 'Today' || day === 'Yesterday' ? ` ${day.toLowerCase()}` : '';
      return {
        at: g.latest,
        when: day,
        text: `${plural(g.count, 'person', 'people')} affirmed the directory terms${rel}.`,
      };
    }),
    ...byDay(input.rsvps).map((g) => ({
      at: g.latest,
      when: whenLabel(g.latest, now, false),
      text: `${plural(g.count, 'new RSVP', 'new RSVPs')} came in.`,
    })),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
