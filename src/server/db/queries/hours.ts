import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, members, serviceHours } from '../schema';
import { HttpError } from '../../http';
import { toMinutes, yearRange } from '../../hours';

type HoursRow = typeof serviceHours.$inferSelect;

export function hoursView(r: HoursRow & { loggedByName?: string | null }) {
  return {
    id: r.id,
    memberId: r.memberId,
    workDate: r.workDate,
    hours: r.minutes / 60,
    description: r.description,
    loggedByName: r.loggedByName ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

/** One member's entries for a year, newest first. */
export async function listHours(memberId: string, year: number) {
  const [from, to] = yearRange(year);
  const rows = await db()
    .select({ h: serviceHours, loggedByName: appUsers.name })
    .from(serviceHours)
    .leftJoin(appUsers, eq(appUsers.id, serviceHours.loggedBy))
    .where(
      and(
        eq(serviceHours.memberId, memberId),
        gte(serviceHours.workDate, from),
        lte(serviceHours.workDate, to),
      ),
    )
    .orderBy(desc(serviceHours.workDate), desc(serviceHours.createdAt));
  return rows.map((r) => hoursView({ ...r.h, loggedByName: r.loggedByName }));
}

/** Every member's total for a year, for the officers' Members tab. */
export async function hoursTotals(year: number) {
  const [from, to] = yearRange(year);
  const rows = await db()
    .select({
      memberId: serviceHours.memberId,
      minutes: sql<number>`sum(${serviceHours.minutes})::int`,
    })
    .from(serviceHours)
    .where(and(gte(serviceHours.workDate, from), lte(serviceHours.workDate, to)))
    .groupBy(serviceHours.memberId);
  return Object.fromEntries(rows.map((r) => [r.memberId, r.minutes / 60]));
}

export async function memberExists(id: string) {
  const [row] = await db()
    .select({ id: members.id })
    .from(members)
    .where(eq(members.id, id))
    .limit(1);
  if (!row) throw new HttpError(404, 'That member was not found.');
}

export async function addHours(
  input: { memberId: string; workDate: string; hours: number; description: string },
  loggedBy: string,
) {
  const [row] = await db()
    .insert(serviceHours)
    .values({
      memberId: input.memberId,
      workDate: input.workDate,
      minutes: toMinutes(input.hours),
      description: input.description,
      loggedBy,
    })
    .returning();
  return row;
}

export async function getHours(id: string) {
  const [row] = await db().select().from(serviceHours).where(eq(serviceHours.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That entry was not found.');
  return row;
}

export async function deleteHours(id: string) {
  await db().delete(serviceHours).where(eq(serviceHours.id, id));
}
