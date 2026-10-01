import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import {
  assigneeToNotify,
  deleteTask,
  getAssignee,
  getTask,
  taskView,
  updateTask,
} from '@/server/db/queries/tasks';
import { parseOrThrow, taskPatchSchema } from '@/server/schemas';
import { notifyAssignee } from '@/server/tasks';

export const prerender = false;

/** Edit part or all of a task. A drag between columns sends only { status }. */
export const PATCH: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const before = await getTask(ctx.params.id!);
  const patch = parseOrThrow(taskPatchSchema, await readJson(ctx));
  if (patch.assigneeId) await getAssignee(patch.assigneeId);
  const row = await updateTask(before.id, patch);
  const to = assigneeToNotify(before.assigneeId, patch.assigneeId, session.userId);
  const emailed = to ? await notifyAssignee(row, to, session.name) : null;
  return json({ task: taskView(row), emailed });
});

export const DELETE: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  await deleteTask(ctx.params.id!);
  return json({ ok: true });
});
