import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import {
  addTaskEvents,
  checkAssignees,
  deleteTask,
  getAssigneeIds,
  getTask,
  taskView,
  updateTask,
} from '@/server/db/queries/tasks';
import { parseOrThrow, resolveAssigneeIds, taskPatchSchema } from '@/server/schemas';
import { afterTaskSave } from '@/server/tasks';

export const prerender = false;

/**
 * Edit part or all of a task. A drag between columns sends only { status }.
 * assigneeIds replaces the list of people on it; the old assigneeId does too,
 * unless the task has several people, in which case it only adds one.
 */
export const PATCH: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const before = await getTask(ctx.params.id!);
  const patch = parseOrThrow(taskPatchSchema, await readJson(ctx));
  const beforeIds = await getAssigneeIds(before.id);
  const ids = resolveAssigneeIds(patch, beforeIds);
  if (ids) await checkAssignees(ids, beforeIds);
  const { row, inserted } = await updateTask(before.id, patch, ids, session.userId);
  const result = await afterTaskSave({
    row,
    before: { status: before.status, assigneeIds: beforeIds },
    after: ids,
    inserted,
    actor: session,
  });
  return json({ task: taskView(row, ids ?? beforeIds), ...result });
});

/** The feed keeps the title: the deleted event has no task id, since the task is gone. */
export const DELETE: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const row = await deleteTask(ctx.params.id!);
  await addTaskEvents([
    {
      taskId: null,
      type: 'deleted',
      actor: { userId: session.userId, name: session.name },
      fromStatus: row.status,
      meta: { title: row.title, taskId: row.id },
    },
  ]).catch((err) => console.error('[tasks] could not log the delete', err));
  return json({ ok: true });
});
