import type { APIRoute } from 'astro';
import { badRequest, json, requireRole, route } from '@/server/http';
import { hoursTotals } from '@/server/db/queries/hours';

export const prerender = false;

/** Officers: { totals: { [memberId]: hours } } for a year. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const year = Number(ctx.url.searchParams.get('year') ?? new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2020 || year > 2100)
    throw badRequest('That year does not look right.');
  return json({ totals: await hoursTotals(year) });
});
