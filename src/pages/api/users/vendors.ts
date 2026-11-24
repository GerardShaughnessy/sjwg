import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { listVendors } from '@/server/db/queries/users';

export const prerender = false;

/** The Vendors page: every enabled vendor. Officers and the Admin can read it. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json({ vendors: await listVendors() });
});
