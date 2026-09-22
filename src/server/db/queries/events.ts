import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { events } from '../schema';
import { HttpError } from '../../http';
import { isUniqueViolation } from '../../refs';
import { slugify } from '@/lib/trades';
import type { z } from 'astro/zod';
import type { eventSchema } from '../../schemas';

type EventInput = z.output<typeof eventSchema>;

export function eventView(e: typeof events.$inferSelect) {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    kind: e.kind,
    start: e.start.toISOString(),
    end: e.end?.toISOString() ?? undefined,
    location: e.location,
    summary: e.summary,
    body: e.body,
    membersOnly: e.membersOnly,
    published: e.published,
    tk: e.tk ?? undefined,
  };
}

export async function listEvents(includeUnpublished: boolean) {
  const rows = await db()
    .select()
    .from(events)
    .where(includeUnpublished ? undefined : eq(events.published, true))
    .orderBy(asc(events.start));
  return rows.map(eventView);
}

function toRow(input: EventInput) {
  return {
    title: input.title,
    kind: input.kind,
    start: new Date(input.start),
    end: input.end ? new Date(input.end) : null,
    location: input.location,
    summary: input.summary,
    body: input.body,
    membersOnly: input.membersOnly,
    published: input.published,
    tk: input.tk ?? null,
  };
}

export async function createEvent(input: EventInput, createdBy: string) {
  const root = `${slugify(input.title)}-${new Date(input.start).getFullYear()}` || 'event';
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    try {
      const [row] = await db()
        .insert(events)
        .values({ ...toRow(input), slug, createdBy })
        .returning();
      return row;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError(409, 'An event with that title and year already exists.');
}

export async function updateEvent(id: string, input: EventInput) {
  const [row] = await db()
    .update(events)
    .set({ ...toRow(input), updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  if (!row) throw new HttpError(404, 'That event was not found.');
  return row;
}

export async function deleteEvent(id: string) {
  const [row] = await db().delete(events).where(eq(events.id, id)).returning();
  if (!row) throw new HttpError(404, 'That event was not found.');
  return row;
}
