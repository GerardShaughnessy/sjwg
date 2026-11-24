import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { deleteTimeEntry, getTimeEntry } from '@/server/db/queries/tasks';
import { assertCanDeleteTime } from '@/server/task-rules';

export const prerender = false;

/** Delete a time entry: your own, or any if you are an officer. */
export const DELETE: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const entry = await getTimeEntry(ctx.params.entryId!);
  assertCanDeleteTime(s, entry);
  await deleteTimeEntry(entry.id);
  return json({ ok: true });
});
