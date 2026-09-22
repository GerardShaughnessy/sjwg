import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  members,
  requestEvents,
  requestNotes,
  requestPhotos,
  requests,
  type requestStatus,
} from '../schema';
import type { AppSession } from '../../auth/server';
import { HttpError } from '../../http';

export type RequestStatus = (typeof requestStatus.enumValues)[number];

/** Shape the portal's job board consumes. Same field names as the mockup's HelpRequest. */
export interface RequestView {
  id: string;
  ref: string;
  createdAt: string;
  status: RequestStatus;
  trade: string;
  tradeSlug: string;
  description: string;
  urgency: string;
  zip: string;
  neighborhood: string;
  contact: { name: string; phone: string; email: string; bestTime: string };
  claimedBy: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  notes: string | null;
  photos: { id: string; url: string }[];
  noteCount: number;
  source: string;
}

export async function listRequests(status?: RequestStatus | 'active'): Promise<RequestView[]> {
  const d = db();
  const where =
    status === 'active'
      ? inArray(requests.status, ['open', 'claimed', 'referred'])
      : status
        ? eq(requests.status, status)
        : undefined;
  const rows = await d
    .select({ r: requests, claimedByName: members.name })
    .from(requests)
    .leftJoin(members, eq(requests.claimedBy, members.id))
    .where(where)
    .orderBy(desc(requests.createdAt))
    .limit(500);
  if (rows.length === 0) return [];
  const ids = rows.map((x) => x.r.id);
  const photos = await d.select().from(requestPhotos).where(inArray(requestPhotos.requestId, ids));
  const counts = await d
    .select({ requestId: requestNotes.requestId, n: sql<number>`count(*)` })
    .from(requestNotes)
    .where(inArray(requestNotes.requestId, ids))
    .groupBy(requestNotes.requestId);
  const countMap = new Map(counts.map((c) => [c.requestId, Number(c.n)]));
  return rows.map(({ r, claimedByName }) => ({
    id: r.id,
    ref: r.ref,
    createdAt: r.createdAt.toISOString(),
    status: r.status,
    trade: r.trade,
    tradeSlug: r.tradeSlug,
    description: r.description,
    urgency: r.urgency,
    zip: r.zip,
    neighborhood: r.neighborhood,
    contact: {
      name: r.contactName,
      phone: r.contactPhone,
      email: r.contactEmail,
      bestTime: r.bestTime,
    },
    claimedBy: r.claimedBy,
    claimedByName,
    claimedAt: r.claimedAt?.toISOString() ?? null,
    notes: r.referralNote,
    photos: photos
      .filter((p) => p.requestId === r.id)
      .map((p) => ({ id: p.id, url: `/api/files/requests/${r.id}/${p.id}` })),
    noteCount: countMap.get(r.id) ?? 0,
    source: r.source,
  }));
}

export async function getRequest(id: string) {
  const [row] = await db().select().from(requests).where(eq(requests.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That request was not found.');
  return row;
}

type Transition = {
  action: 'claimed' | 'referred' | 'closed' | 'reopened';
  to: RequestStatus;
  from: RequestStatus[];
};
const TRANSITIONS: Record<string, Transition> = {
  claim: { action: 'claimed', to: 'claimed', from: ['open'] },
  refer: { action: 'referred', to: 'referred', from: ['open', 'claimed'] },
  close: { action: 'closed', to: 'closed', from: ['open', 'claimed', 'referred'] },
  reopen: { action: 'reopened', to: 'open', from: ['claimed', 'referred', 'closed'] },
};

/** Atomic status change: the UPDATE carries the precondition so two members cannot both claim. */
export async function transition(
  id: string,
  kind: keyof typeof TRANSITIONS,
  session: AppSession,
  note?: string,
) {
  const t = TRANSITIONS[kind];
  const d = db();
  const now = new Date();
  const set: Partial<typeof requests.$inferInsert> = { status: t.to, updatedAt: now };
  if (kind === 'claim') Object.assign(set, { claimedBy: session.memberId, claimedAt: now });
  if (kind === 'reopen') Object.assign(set, { claimedBy: null, claimedAt: null, closedAt: null });
  if (kind === 'close') Object.assign(set, { closedAt: now });
  if (kind === 'refer') Object.assign(set, { referralNote: note ?? null });
  const [before] = await d
    .select({ status: requests.status })
    .from(requests)
    .where(eq(requests.id, id))
    .limit(1);
  if (!before) throw new HttpError(404, 'That request was not found.');
  const [updated] = await d
    .update(requests)
    .set(set)
    .where(and(eq(requests.id, id), inArray(requests.status, t.from)))
    .returning();
  if (!updated) {
    const msg =
      kind === 'claim'
        ? 'Someone just claimed this one. Refresh to see who.'
        : `This request is ${before.status} and cannot be ${t.action} from there. Refresh and try again.`;
    throw new HttpError(409, msg);
  }
  await d.insert(requestEvents).values({
    requestId: id,
    actorKind: 'member',
    actorUserId: session.userId,
    actorName: session.name,
    action: t.action,
    fromStatus: before.status,
    toStatus: t.to,
    detail: note ? { note } : null,
  });
  return updated;
}

export async function listEvents(requestId: string) {
  return db()
    .select()
    .from(requestEvents)
    .where(eq(requestEvents.requestId, requestId))
    .orderBy(requestEvents.createdAt);
}

export async function listNotes(requestId: string, visibleOnly: boolean) {
  const where = visibleOnly
    ? and(eq(requestNotes.requestId, requestId), eq(requestNotes.visibleToRequester, true))
    : eq(requestNotes.requestId, requestId);
  return db().select().from(requestNotes).where(where).orderBy(requestNotes.createdAt);
}
