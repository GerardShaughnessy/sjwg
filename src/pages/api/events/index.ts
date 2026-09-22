import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import { createEvent, eventView, listEvents } from '@/server/db/queries/events';
import { eventSchema, parseOrThrow } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

/** Public: published events. Officers also see unpublished ones. */
export const GET: APIRoute = route(async (ctx) => {
  const admin = ctx.locals.session?.role === 'admin';
  return json({ events: await listEvents(admin) }, 200, {
    'cache-control': admin ? 'no-store' : 'public, max-age=60',
  });
});

export const POST: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const input = parseOrThrow(eventSchema, await readJson(ctx));
  const row = await createEvent(input, session.userId);
  const rebuild = row.published ? await requestRebuild(`event added: ${row.title}`) : null;
  return json({ event: eventView(row), rebuild }, 201);
});
