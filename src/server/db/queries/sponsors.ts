import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { sponsors } from '../schema';
import { HttpError } from '../../http';
import { sponsorLogoUrl } from '../../../lib/sponsor-logo';

export function sponsorView(s: typeof sponsors.$inferSelect) {
  return {
    id: s.id,
    name: s.name,
    url: s.url,
    tier: s.tier,
    logo: sponsorLogoUrl(s.logoKey),
    logoAlt: s.logoAlt || s.name,
    active: s.active,
    sortOrder: s.sortOrder,
  };
}

export async function listSponsors(includeInactive: boolean) {
  const rows = await db()
    .select()
    .from(sponsors)
    .where(includeInactive ? undefined : eq(sponsors.active, true))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));
  return rows.map(sponsorView);
}

export async function getSponsor(id: string) {
  const [row] = await db().select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That sponsor was not found.');
  return row;
}
