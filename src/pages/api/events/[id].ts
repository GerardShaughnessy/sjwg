import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import { deleteEvent, eventView, updateEvent } from '@/server/db/queries/events';
import { eventSchema, parseOrThrow } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

export const PUT: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const input = parseOrThrow(eventSchema, await readJson(ctx));
  const row = await updateEvent(ctx.params.id!, input);
  const rebuild = await requestRebuild(`event edited: ${row.title}`);
  return json({ event: eventView(row), rebuild });
});

export const DELETE: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const row = await deleteEvent(ctx.params.id!);
  const rebuild = row.published ? await requestRebuild(`event deleted: ${row.title}`) : null;
  return json({ ok: true, rebuild });
});
