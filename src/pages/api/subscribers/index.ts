import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { listSubscribers } from '@/server/db/queries/subscribers';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json(await listSubscribers());
});
