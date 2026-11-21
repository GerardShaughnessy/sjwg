import { and, asc, count, desc, eq, gt, gte, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { db } from './db/client';
import {
  aidApplications,
  appUsers,
  directoryAffirmations,
  documents,
  events,
  formSubmissions,
  invitations,
  members,
  signRequests,
  tasks,
} from './db/schema';
import type { AppSession } from './auth/server';
import { photoUrl } from './db/queries/members';
import { listMemberDocs, type MemberDocView } from './member-docs';
import { memberSignRequests, requestsForMember, type SignRequestView } from './esign';
import {
  buildActivity,
  doneCount,
  memberTodos,
  progressTotal,
  STALE_DAYS,
  tradesmanStatus,
  type ActivityItem,
  type ChecklistItem,
  type Todo,
  type Tone,
} from './portal-status';

const DAY = 24 * 3600 * 1000;

export interface UpcomingEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  location: string;
}

export interface MySummary {
  memberId: string;
  name: string;
  trade: string;
  listed: boolean;
  checklist: ChecklistItem[];
  done: number;
  total: number;
  tone: Tone;
  todos: Todo[];
}

export interface OfficerCounts {
  aidNew: number;
  aidEmergency: number;
  docsPending: number;
  docsExpiring: number;
  paperworkOpen: number;
  paperworkStale: number;
  tasksOpen: number;
  tasksDueSoon: number;
  tradesmenNeedingAction: number;
}

export interface PortalSummary {
  role: 'admin' | 'member';
  /** Shown under the name in the header: the trade, or "Guild officer". */
  roleLabel: string;
  upcoming: UpcomingEvent[];
  mine: MySummary | null;
  officer: { counts: OfficerCounts; activity: ActivityItem[] } | null;
  /** Sidebar badges by tab id. */
  badges: Record<string, number>;
}

export interface TradesmanRow {
  id: string;
  name: string;
  trade: string;
  yearsInTrade: number;
  areas: string[];
  bio: string;
  photo: string | null;
  listed: boolean;
  showContact: boolean;
  privateEmail: string;
  privatePhone: string;
  accountEmail: string | null;
  invited: boolean;
  checklist: ChecklistItem[];
  done: number;
  tone: Tone;
  note: string;
  needsAction: boolean;
  documents: MemberDocView[];
  signRequests: SignRequestView[];
}

export async function upcomingEvents(now: Date, limit = 3): Promise<UpcomingEvent[]> {
  const rows = await db()
    .select({
      id: events.id,
      title: events.title,
      start: events.start,
      end: events.end,
      location: events.location,
    })
    .from(events)
    .where(
      and(eq(events.published, true), gte(events.start, new Date(now.getTime() - 3 * 3600 * 1000))),
    )
    .orderBy(asc(events.start))
    .limit(limit);
  return rows.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start.toISOString(),
    end: e.end?.toISOString() ?? null,
    location: e.location,
  }));
}

/** One tradesman's own checklist and to-dos. Only ever called with the caller's own member id. */
export async function mySummary(memberId: string, now: Date): Promise<MySummary | null> {
  const [m] = await db()
    .select({ id: members.id, name: members.name, trade: members.trade, public: members.public })
    .from(members)
    .where(eq(members.id, memberId))
    .limit(1);
  if (!m) return null;
  const [docs, signs] = await Promise.all([listMemberDocs(memberId), requestsForMember(memberId)]);
  const status = tradesmanStatus({ docs, signs, listed: m.public, now });
  return {
    memberId: m.id,
    name: m.name,
    trade: m.trade,
    listed: m.public,
    checklist: status.checklist,
    done: doneCount(status.checklist),
    total: progressTotal(status.checklist),
    tone: status.tone,
    todos: memberTodos({ docs, signs, listed: m.public, now }),
  };
}

/** Every directory row with its checklist, documents, and paperwork. Officers only. */
export async function tradesmenRoster(now: Date): Promise<TradesmanRow[]> {
  const [rows, docs, signs, invites] = await Promise.all([
    db()
      .select({ m: members, accountEmail: appUsers.email })
      .from(members)
      .leftJoin(appUsers, eq(appUsers.memberId, members.id))
      .orderBy(asc(members.name)),
    listMemberDocs(),
    memberSignRequests(),
    db()
      .selectDistinct({ memberId: invitations.memberId })
      .from(invitations)
      .where(
        and(
          isNotNull(invitations.memberId),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, now),
        ),
      ),
  ]);
  const invited = new Set(invites.map((i) => i.memberId));
  const docsBy = group(docs, (d) => d.memberId);
  const signsBy = group(
    signs.filter((s) => s.memberId),
    (s) => s.memberId!,
  );
  // A member row can have more than one login; keep the first.
  const seen = new Set<string>();
  const out: TradesmanRow[] = [];
  for (const { m, accountEmail } of rows) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const myDocs = docsBy.get(m.id) ?? [];
    const mySigns = signsBy.get(m.id) ?? [];
    const s = tradesmanStatus({
      docs: myDocs,
      signs: mySigns,
      listed: m.public,
      invited: invited.has(m.id) && !accountEmail,
      now,
    });
    out.push({
      id: m.id,
      name: m.name,
      trade: m.trade,
      yearsInTrade: m.yearsInTrade,
      areas: m.areas,
      bio: m.bio,
      photo: photoUrl(m.photoKey),
      listed: m.public,
      showContact: m.showContact,
      privateEmail: m.privateEmail ?? '',
      privatePhone: m.privatePhone ?? '',
      accountEmail,
      invited: invited.has(m.id) && !accountEmail,
      checklist: s.checklist,
      done: s.done,
      tone: s.tone,
      note: s.note,
      needsAction: s.needsAction,
      documents: myDocs,
      signRequests: mySigns.filter((r) => r.status !== 'voided'),
    });
  }
  return out;
}

function group<T>(list: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of list) m.set(key(t), [...(m.get(key(t)) ?? []), t]);
  return m;
}

async function officerCounts(now: Date, roster: TradesmanRow[]): Promise<OfficerCounts> {
  const weekOut = new Date(now.getTime() + 7 * DAY).toISOString().slice(0, 10);
  const [aid, taskRows] = await Promise.all([
    db()
      .select({
        n: count(),
        emergency: sql<number>`count(*) filter (where ${aidApplications.urgency} = 'emergency')`,
      })
      .from(aidApplications)
      .where(eq(aidApplications.status, 'new')),
    db()
      .select({
        n: count(),
        due: sql<number>`count(*) filter (where ${tasks.dueDate} is not null and ${tasks.dueDate} <= ${weekOut}::date)`,
      })
      .from(tasks)
      .where(ne(tasks.status, 'done')),
  ]);
  // Counted from the roster, so every counted item is visible where the tile
  // leads: pending documents put a tradesman under Needs action, and every
  // open request tied to a member is listed under All paperwork.
  const docsPending = roster.reduce(
    (n, t) => n + t.documents.filter((d) => d.status === 'pending').length,
    0,
  );
  const open = roster.flatMap((t) =>
    t.signRequests.filter((r) => r.status === 'sent' || r.status === 'viewed'),
  );
  const staleBefore = now.getTime() - STALE_DAYS * DAY;
  const expiring = roster.reduce(
    (n, t) =>
      n +
      t.checklist.filter(
        (i) =>
          (i.key === 'insurance' || i.key === 'license') && /^(Expires|Expired)/.test(i.detail),
      ).length,
    0,
  );
  return {
    aidNew: Number(aid[0]?.n ?? 0),
    aidEmergency: Number(aid[0]?.emergency ?? 0),
    docsPending,
    docsExpiring: expiring,
    paperworkOpen: open.length,
    paperworkStale: open.filter((r) => Date.parse(r.sentAt) < staleBefore).length,
    tasksOpen: Number(taskRows[0]?.n ?? 0),
    tasksDueSoon: Number(taskRows[0]?.due ?? 0),
    tradesmenNeedingAction: roster.filter((t) => t.needsAction).length,
  };
}

async function officerActivity(now: Date): Promise<ActivityItem[]> {
  const since = new Date(now.getTime() - 30 * DAY);
  const [aid, uploads, signed, affirmations, rsvps] = await Promise.all([
    db()
      .select({
        id: aidApplications.id,
        at: aidApplications.createdAt,
        contactName: aidApplications.contactName,
        orgName: aidApplications.orgName,
        urgency: aidApplications.urgency,
      })
      .from(aidApplications)
      .orderBy(desc(aidApplications.createdAt))
      .limit(10),
    db()
      .select({ at: documents.createdAt, kind: documents.kind, name: members.name })
      .from(documents)
      .innerJoin(members, eq(members.id, documents.ownerId))
      .where(eq(documents.ownerType, 'member'))
      .orderBy(desc(documents.createdAt))
      .limit(10),
    db()
      .select({
        at: signRequests.signedAt,
        name: signRequests.signerName,
        title: signRequests.title,
      })
      .from(signRequests)
      .where(isNotNull(signRequests.signedAt))
      .orderBy(desc(signRequests.signedAt))
      .limit(10),
    // Only the times: the feed never names who affirmed.
    db()
      .select({ at: directoryAffirmations.createdAt })
      .from(directoryAffirmations)
      .where(gte(directoryAffirmations.createdAt, since))
      .orderBy(desc(directoryAffirmations.createdAt))
      .limit(2000),
    db()
      .select({ at: formSubmissions.createdAt })
      .from(formSubmissions)
      .where(and(eq(formSubmissions.kind, 'rsvp'), gte(formSubmissions.createdAt, since)))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(2000),
  ]);
  return buildActivity(
    {
      aid: aid.map((a) => ({
        id: a.id,
        at: a.at.toISOString(),
        who: a.orgName || a.contactName,
        urgency: a.urgency,
      })),
      uploads: uploads.map((u) => ({ at: u.at.toISOString(), name: u.name, kind: u.kind })),
      signed: signed.map((s) => ({ at: s.at!.toISOString(), name: s.name, title: s.title })),
      affirmations: affirmations.map((a) => ({ at: a.at.toISOString() })),
      rsvps: rsvps.map((r) => ({ at: r.at.toISOString() })),
    },
    now,
  );
}

/** Everything the sidebar badges, the officer Dashboard, and the tradesman Home need. */
export async function portalSummary(s: AppSession, now = new Date()): Promise<PortalSummary> {
  const isAdmin = s.role === 'admin';
  const [upcoming, mine, roster] = await Promise.all([
    upcomingEvents(now),
    s.memberId ? mySummary(s.memberId, now) : Promise.resolve(null),
    isAdmin ? tradesmenRoster(now) : Promise.resolve([] as TradesmanRow[]),
  ]);
  const officer = isAdmin
    ? await Promise.all([officerCounts(now, roster), officerActivity(now)]).then(
        ([counts, activity]) => ({ counts, activity }),
      )
    : null;
  const badges: Record<string, number> = officer
    ? {
        tradesmen: officer.counts.tradesmenNeedingAction,
        aid: officer.counts.aidNew,
        tasks: officer.counts.tasksOpen,
      }
    : { home: mine?.todos.length ?? 0 };
  return {
    role: s.role,
    roleLabel: isAdmin ? 'Guild officer' : mine?.trade || 'Guild member',
    upcoming,
    mine,
    officer,
    badges,
  };
}
