import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { tradesmenRoster } from '@/server/portal-summary';

export const prerender = false;

/** Officers: every directory row with checklist, note, documents, and paperwork. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json({ tradesmen: await tradesmenRoster(new Date()) });
});
