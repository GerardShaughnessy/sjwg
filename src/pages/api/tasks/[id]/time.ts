import type { APIRoute } from 'astro';
import { HttpError, json, readJson, requireSession, route } from '@/server/http';
import {
  addTaskEvents,
  addTaskTime,
  getTask,
  isOnTask,
  listTaskTime,
} from '@/server/db/queries/tasks';
import { parseOrThrow, taskTimeSchema } from '@/server/schemas';
import { assertCanLogTime, isTaskManager } from '@/server/task-rules';

export const prerender = false;

/** Every time entry on a task. Officers, or people on the task. */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const task = await getTask(ctx.params.id!);
  if (!isTaskManager(s) && !(await isOnTask(task.id, s.userId)))
    throw new HttpError(404, 'That task was not found.');
  return json({ entries: await listTaskTime(task.id) });
});

/** Log time on a task: people on it, or any officer. Shows in the Dashboard feed. */
export const POST: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const task = await getTask(ctx.params.id!);
  assertCanLogTime(s, isTaskManager(s) || (await isOnTask(task.id, s.userId)));
  const input = parseOrThrow(taskTimeSchema, await readJson(ctx));
  const minutes = input.hours * 60 + input.minutes;
  const row = await addTaskTime({
    taskId: task.id,
    userId: s.userId,
    minutes,
    workedOn: input.workedOn,
    note: input.note,
  });
  await addTaskEvents([
    {
      taskId: task.id,
      type: 'time_logged',
      actor: { userId: s.userId, name: s.name },
      meta: { title: task.title, minutes },
    },
  ]).catch((err) => console.error('[tasks] could not log the time event', err));
  return json({ entry: { id: row.id, minutes } }, 201);
});
