import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { portalSummary } from '@/server/portal-summary';

export const prerender = false;

/**
 * Sidebar badges, the officer Dashboard, and the tradesman Home in one call.
 * A member gets only his own checklist and to-dos; officer counts and the
 * activity feed are added for officers.
 */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  return json(await portalSummary(s));
});
