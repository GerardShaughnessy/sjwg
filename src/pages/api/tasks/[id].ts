import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import {
  addTaskEvents,
  checkAssignees,
  deleteTask,
  getAssigneeIds,
  getTask,
  taskView,
  updateTask,
} from '@/server/db/queries/tasks';
import {
  assertTaskSection,
  parseOrThrow,
  resolveAssigneeIds,
  taskPatchSchema,
} from '@/server/schemas';
import { afterTaskSave } from '@/server/tasks';
import {
  appendNote,
  assertTaskManager,
  assertTaskPatchAllowed,
  noteLine,
} from '@/server/task-rules';

export const prerender = false;

const noteDay = () =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  }).format(new Date());

/**
 * Edit part or all of a task. A drag between columns sends only { status }.
 * Officers may change anything. Someone on the task may only move it or add
 * a note (addNote). assigneeIds replaces the list of people on it; the old
 * assigneeId does too, unless the task has several people, in which case it
 * only adds one.
 */
export const PATCH: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const before = await getTask(ctx.params.id!);
  const patch = parseOrThrow(taskPatchSchema, await readJson(ctx));
  const beforeIds = await getAssigneeIds(before.id);
  const fields = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  assertTaskPatchAllowed(session, beforeIds.includes(session.userId), fields);
  assertTaskSection(patch.section, before.section);
  const ids = resolveAssigneeIds(patch, beforeIds);
  if (ids) await checkAssignees(ids, beforeIds);
  const save = { ...patch };
  let appendLine: string | undefined;
  if (patch.addNote) {
    const by = session.name.split(' ')[0] || session.name;
    // Replacing the notes too: append to the new text. Otherwise the
    // database appends to whatever is there now, so no note is lost.
    if (patch.notes !== undefined)
      save.notes = appendNote(patch.notes, by, patch.addNote, noteDay());
    else appendLine = noteLine(by, patch.addNote, noteDay());
  }
  const { row, inserted } = await updateTask(before.id, save, ids, session.userId, { appendLine });
  const result = await afterTaskSave({
    row,
    before: { status: before.status, assigneeIds: beforeIds },
    after: ids,
    inserted,
    actor: session,
  });
  return json({ task: taskView(row, ids ?? beforeIds), ...result });
});

/**
 * Officers only. A task with logged time needs `{ force: true }` in the body,
 * or it is refused with a 409. The feed keeps the title: the deleted event has
 * no task id, since the task is gone.
 */
export const DELETE: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  assertTaskManager(session);
  const body = (await ctx.request.json().catch(() => null)) as { force?: unknown } | null;
  const row = await deleteTask(ctx.params.id!, { force: body?.force === true });
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
