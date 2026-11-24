import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { timeSummary } from '@/server/db/queries/tasks';
import { isTaskManager } from '@/server/task-rules';
import { chicagoDate } from '@/server/reminders';

export const prerender = false;

/**
 * Hours per person, this month and all time, and the latest entries.
 * Officers see everyone (or ?person=<id>); everyone else sees their own.
 */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const asked = ctx.url.searchParams.get('person') || undefined;
  const person = isTaskManager(s) ? asked : s.userId;
  if (person && !/^[0-9a-f-]{36}$/i.test(person)) return json({ people: [], recent: [] });
  const monthStart = `${chicagoDate(new Date()).slice(0, 7)}-01`;
  return json({ monthStart, ...(await timeSummary(monthStart, person)) });
});
