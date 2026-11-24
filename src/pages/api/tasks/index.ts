import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import {
  checkAssignees,
  createTask,
  listAssignees,
  listTasks,
  taskView,
} from '@/server/db/queries/tasks';
import { parseOrThrow, resolveAssigneeIds, taskSchema } from '@/server/schemas';
import { afterTaskSave } from '@/server/tasks';
import { assertTaskManager, isTaskManager } from '@/server/task-rules';

export const prerender = false;

/**
 * The board. Officers and the Admin get every task and everyone a task can
 * go to. Everyone else gets only the tasks they are on, and the names of the
 * people on them.
 */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const manager = isTaskManager(s);
  const tasks = await listTasks(manager ? undefined : s.userId);
  const onTasks = [...new Set(tasks.flatMap((t) => t.assigneeIds))];
  const assignees = await listAssignees({ manager, onTasks });
  return json({ tasks, assignees, canManage: manager });
});

/** Officers only. Accepts assigneeIds, or the old single assigneeId. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  assertTaskManager(session);
  const input = parseOrThrow(taskSchema, await readJson(ctx));
  const ids = resolveAssigneeIds(input) ?? [];
  await checkAssignees(ids);
  const { row, inserted } = await createTask(input, ids, session.userId);
  const result = await afterTaskSave({ row, before: null, after: ids, inserted, actor: session });
  return json({ task: taskView(row, ids), ...result }, 201);
});
