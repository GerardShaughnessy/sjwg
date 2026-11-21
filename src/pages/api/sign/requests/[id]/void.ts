import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { toView, voidSignRequest } from '@/server/esign';

export const prerender = false;

export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  return json({ request: toView(await voidSignRequest(ctx.params.id!, by)) });
});
