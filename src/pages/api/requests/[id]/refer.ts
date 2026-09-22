import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import { transition } from '@/server/db/queries/requests';
import { parseOrThrow, referSchema } from '@/server/schemas';

export const prerender = false;

export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const { note } = parseOrThrow(referSchema, await readJson(ctx));
  const updated = await transition(ctx.params.id!, 'refer', session, note);
  return json({ id: updated.id, status: updated.status, notes: updated.referralNote });
});
