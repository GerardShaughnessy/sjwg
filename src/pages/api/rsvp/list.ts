import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { CHRISTMAS, christmasRsvps, headCount } from '@/server/rsvp/christmas';

export const prerender = false;

/** Officers only: every Christmas party RSVP (latest answer per email) and the totals. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const rows = await christmasRsvps();
  const sorted = [...rows].sort((a, b) =>
    a.attending === b.attending ? b.at.getTime() - a.at.getTime() : a.attending === 'yes' ? -1 : 1,
  );
  return json({
    capacity: CHRISTMAS.capacity,
    coming: headCount(rows),
    yes: rows.filter((r) => r.attending === 'yes').length,
    no: rows.filter((r) => r.attending === 'no').length,
    adults: rows.filter((r) => r.attending === 'yes').reduce((n, r) => n + r.adults, 0),
    children: rows.filter((r) => r.attending === 'yes').reduce((n, r) => n + r.children, 0),
    rsvps: sorted.map((r) => ({ ...r, at: r.at.toISOString() })),
  });
});
