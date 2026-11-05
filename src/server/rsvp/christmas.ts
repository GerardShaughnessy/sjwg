import { asc, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { formSubmissions } from '@/server/db/schema';

/** The 2026 Christmas party. Temporary: delete with /christmas after the party. */
export const CHRISTMAS = {
  event: 'christmas-2026',
  capacity: 100,
  /** RSVPs close at the end of the party day, St. Louis time. */
  closesAt: new Date('2026-12-21T06:00:00Z'),
};

export interface RsvpRow {
  name: string;
  email: string;
  phone: string;
  attending: 'yes' | 'no';
  adults: number;
  children: number;
  at: Date;
}

/** Latest answer per email wins, so people can change their RSVP. */
export async function christmasRsvps(): Promise<RsvpRow[]> {
  const rows = await db()
    .select({ payload: formSubmissions.payload, createdAt: formSubmissions.createdAt })
    .from(formSubmissions)
    .where(eq(formSubmissions.kind, 'rsvp'))
    .orderBy(asc(formSubmissions.createdAt));
  const byEmail = new Map<string, RsvpRow>();
  for (const r of rows) {
    const p = r.payload as Record<string, unknown>;
    if (p.event !== CHRISTMAS.event) continue;
    const email = String(p.email ?? '').toLowerCase();
    byEmail.set(email, {
      name: String(p.name ?? ''),
      email,
      phone: String(p.phone ?? ''),
      attending: p.attending === 'yes' ? 'yes' : 'no',
      adults: Number(p.adults ?? 0),
      children: Number(p.children ?? 0),
      at: r.createdAt,
    });
  }
  return [...byEmail.values()];
}

export function headCount(rows: RsvpRow[], exceptEmail?: string): number {
  return rows
    .filter((r) => r.attending === 'yes' && r.email !== exceptEmail)
    .reduce((n, r) => n + r.adults + r.children, 0);
}
