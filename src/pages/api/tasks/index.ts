import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import {
  assigneeToNotify,
  createTask,
  getAssignee,
  listAssignees,
  listTasks,
  taskView,
} from '@/server/db/queries/tasks';
import { parseOrThrow, taskSchema } from '@/server/schemas';
import { notifyAssignee } from '@/server/tasks';

export const prerender = false;

/** The officers' board: every task, plus who a task can be assigned to. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const [tasks, assignees] = await Promise.all([listTasks(), listAssignees()]);
  return json({ tasks, assignees });
});

export const POST: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const input = parseOrThrow(taskSchema, await readJson(ctx));
  if (input.assigneeId) await getAssignee(input.assigneeId);
  const row = await createTask(input, session.userId);
  const to = assigneeToNotify(null, row.assigneeId, session.userId);
  const emailed = to ? await notifyAssignee(row, to, session.name) : null;
  return json({ task: taskView(row), emailed }, 201);
});
