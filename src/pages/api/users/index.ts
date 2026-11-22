import type { APIRoute } from 'astro';
import { json, requireSiteAdmin, route } from '@/server/http';
import { listUsers } from '@/server/db/queries/users';

export const prerender = false;

/** Every account with its role, title, status, linked tradesman entry, and last login. Admin only. */
export const GET: APIRoute = route(async (ctx) => {
  requireSiteAdmin(ctx);
  return json({ users: await listUsers() });
});
