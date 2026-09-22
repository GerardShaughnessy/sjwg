import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { transition } from '@/server/db/queries/requests';

export const prerender = false;

export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const updated = await transition(ctx.params.id!, 'close', session);
  return json({ id: updated.id, status: updated.status });
});
