import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, taskAssignees, taskEvents, tasks } from '../schema';
import { HttpError, badRequest } from '../../http';
import type { z } from 'astro/zod';
import type { taskPatchSchema, taskSchema } from '../../schemas';

type TaskInput = z.output<typeof taskSchema>;
type TaskPatch = z.output<typeof taskPatchSchema>;
type TaskRow = typeof tasks.$inferSelect;

export function taskView(t: TaskRow, assigneeIds: string[]) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status,
    section: t.section,
    assigneeId: assigneeIds[0] ?? null,
    assigneeIds,
    waitingOn: t.waitingOn,
    dueDate: t.dueDate ?? '',
    sortOrder: t.sortOrder,
    createdBy: t.createdBy,
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Assignee ids per task, in the order they were added. */
async function assigneeMap(taskIds?: string[]) {
  if (taskIds && taskIds.length === 0) return new Map<string, string[]>();
  const q = db()
    .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
    .from(taskAssignees);
  const rows = await (taskIds ? q.where(inArray(taskAssignees.taskId, taskIds)) : q).orderBy(
    asc(taskAssignees.addedAt),
  );
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.taskId, [...(m.get(r.taskId) ?? []), r.userId]);
  return m;
}

export async function getAssigneeIds(taskId: string): Promise<string[]> {
  return (await assigneeMap([taskId])).get(taskId) ?? [];
}

export async function listTasks() {
  const [rows, byTask] = await Promise.all([
    db().select().from(tasks).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
    assigneeMap(),
  ]);
  return rows.map((t) => taskView(t, byTask.get(t.id) ?? []));
}

/** Officers a task can be assigned to. */
export async function listAssignees() {
  return db()
    .select({ id: appUsers.id, name: appUsers.name, email: appUsers.email })
    .from(appUsers)
    .where(and(eq(appUsers.role, 'admin'), eq(appUsers.disabled, false)))
    .orderBy(asc(appUsers.name));
}

export async function getAssignee(id: string) {
  const [row] = await db()
    .select({ id: appUsers.id, name: appUsers.name, email: appUsers.email })
    .from(appUsers)
    .where(and(eq(appUsers.id, id), eq(appUsers.role, 'admin'), eq(appUsers.disabled, false)))
    .limit(1);
  if (!row)
    throw badRequest('Tasks can only go to an officer.', { assigneeIds: 'Pick officers only.' });
  return row;
}

/**
 * Checks newly added people are active officers. People already on the task
 * may stay even if they have since lost officer access.
 */
export async function checkAssignees(ids: string[], keep: string[] = []) {
  const fresh = ids.filter((id) => !keep.includes(id));
  if (fresh.length === 0) return;
  const ok = await db()
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(
      and(inArray(appUsers.id, fresh), eq(appUsers.role, 'admin'), eq(appUsers.disabled, false)),
    );
  if (ok.length !== fresh.length)
    throw badRequest('Tasks can only go to an officer.', { assigneeIds: 'Pick officers only.' });
}

/** First names (or emails) for the feed, in the order given. */
export async function namesFor(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db()
    .select({ id: appUsers.id, name: appUsers.name, email: appUsers.email })
    .from(appUsers)
    .where(inArray(appUsers.id, ids));
  const by = new Map(rows.map((r) => [r.id, r.name?.split(' ')[0] || r.email]));
  return ids.map((id) => by.get(id) ?? 'someone');
}

export async function getTask(id: string) {
  const [row] = await db().select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That task was not found.');
  return row;
}

export async function createTask(input: TaskInput, assigneeIds: string[], createdBy: string) {
  const { assigneeIds: _ids, assigneeId: _id, ...rest } = input;
  const [row] = await db()
    .insert(tasks)
    .values({
      ...rest,
      assigneeId: assigneeIds[0] ?? null,
      dueDate: input.dueDate || null,
      createdBy,
    })
    .returning();
  if (assigneeIds.length)
    await db()
      .insert(taskAssignees)
      .values(assigneeIds.map((userId) => ({ taskId: row.id, userId, addedBy: createdBy })));
  return row;
}

/** Saves the fields in `patch`. `assigneeIds` replaces the list when given. */
export async function updateTask(
  id: string,
  patch: TaskPatch,
  assigneeIds: string[] | undefined,
  actorId: string,
) {
  const { assigneeIds: _ids, assigneeId: _id, ...rest } = patch;
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined) continue;
    (set as Record<string, unknown>)[k] = k === 'dueDate' ? v || null : v;
  }
  if (assigneeIds) set.assigneeId = assigneeIds[0] ?? null;
  const [row] = await db().update(tasks).set(set).where(eq(tasks.id, id)).returning();
  if (!row) throw new HttpError(404, 'That task was not found.');
  if (assigneeIds) {
    const before = await getAssigneeIds(id);
    const gone = before.filter((u) => !assigneeIds.includes(u));
    const fresh = assigneeIds.filter((u) => !before.includes(u));
    if (gone.length)
      await db()
        .delete(taskAssignees)
        .where(and(eq(taskAssignees.taskId, id), inArray(taskAssignees.userId, gone)));
    if (fresh.length)
      await db()
        .insert(taskAssignees)
        .values(fresh.map((userId) => ({ taskId: id, userId, addedBy: actorId })))
        .onConflictDoNothing();
  }
  return row;
}

export async function deleteTask(id: string) {
  const [row] = await db().delete(tasks).where(eq(tasks.id, id)).returning();
  if (!row) throw new HttpError(404, 'That task was not found.');
  return row;
}

/* ---------------------------------------------------------------- events */
export type TaskEventType =
  'created' | 'moved' | 'assigned' | 'unassigned' | 'finished' | 'deleted';

export interface NewTaskEvent {
  taskId: string | null;
  type: TaskEventType;
  actor: { userId: string; name: string };
  fromStatus?: string | null;
  toStatus?: string | null;
  meta: { title: string; names?: string[]; userIds?: string[]; self?: boolean; taskId?: string };
}

export async function addTaskEvents(list: NewTaskEvent[]) {
  if (list.length === 0) return;
  await db()
    .insert(taskEvents)
    .values(
      list.map((e) => ({
        taskId: e.taskId,
        type: e.type,
        actorId: e.actor.userId,
        actorName: e.actor.name.split(' ')[0] || e.actor.name,
        fromStatus: e.fromStatus ?? null,
        toStatus: e.toStatus ?? null,
        meta: e.meta,
      })),
    );
}

/** Whether this task has been finished before (moving it back to Done stays quiet). */
export async function wasFinished(taskId: string): Promise<boolean> {
  const [row] = await db()
    .select({ id: taskEvents.id })
    .from(taskEvents)
    .where(and(eq(taskEvents.taskId, taskId), eq(taskEvents.type, 'finished')))
    .limit(1);
  return Boolean(row);
}

export async function recentTaskEvents(limit = 12) {
  return db()
    .select({
      taskId: taskEvents.taskId,
      type: taskEvents.type,
      actorName: taskEvents.actorName,
      toStatus: taskEvents.toStatus,
      meta: taskEvents.meta,
      at: taskEvents.at,
    })
    .from(taskEvents)
    .orderBy(desc(taskEvents.at))
    .limit(limit);
}
