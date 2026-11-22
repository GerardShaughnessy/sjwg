import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { listOfficers } from '@/server/db/queries/users';

export const prerender = false;

/** The Officers page: every active officer. Any officer can read it. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json({ officers: await listOfficers() });
});
