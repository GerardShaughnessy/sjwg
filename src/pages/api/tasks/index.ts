import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import {
  checkAssignees,
  createTask,
  listAssignees,
  listTasks,
  taskView,
} from '@/server/db/queries/tasks';
import { parseOrThrow, resolveAssigneeIds, taskSchema } from '@/server/schemas';
import { afterTaskSave } from '@/server/tasks';

export const prerender = false;

/** The officers' board: every task, plus who a task can be assigned to. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const [tasks, assignees] = await Promise.all([listTasks(), listAssignees()]);
  return json({ tasks, assignees });
});

/** Accepts assigneeIds, or the old single assigneeId. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const input = parseOrThrow(taskSchema, await readJson(ctx));
  const ids = resolveAssigneeIds(input) ?? [];
  await checkAssignees(ids);
  const row = await createTask(input, ids, session.userId);
  const result = await afterTaskSave({ row, before: null, after: ids, actor: session });
  return json({ task: taskView(row, ids), ...result }, 201);
});
