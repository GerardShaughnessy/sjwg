import { and, asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, tasks } from '../schema';
import { HttpError, badRequest } from '../../http';
import type { z } from 'astro/zod';
import type { taskPatchSchema, taskSchema } from '../../schemas';

type TaskInput = z.output<typeof taskSchema>;
type TaskPatch = z.output<typeof taskPatchSchema>;
type TaskRow = typeof tasks.$inferSelect;

export function taskView(t: TaskRow) {
  return {
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status,
    section: t.section,
    assigneeId: t.assigneeId,
    waitingOn: t.waitingOn,
    dueDate: t.dueDate ?? '',
    sortOrder: t.sortOrder,
    createdBy: t.createdBy,
    updatedAt: t.updatedAt.toISOString(),
  };
}

export async function listTasks() {
  const rows = await db().select().from(tasks).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
  return rows.map(taskView);
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
    throw badRequest('Tasks can only go to an officer.', { assigneeId: 'Pick an officer.' });
  return row;
}

export async function getTask(id: string) {
  const [row] = await db().select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That task was not found.');
  return row;
}

export async function createTask(input: TaskInput, createdBy: string) {
  const [row] = await db()
    .insert(tasks)
    .values({ ...input, dueDate: input.dueDate || null, createdBy })
    .returning();
  return row;
}

export async function updateTask(id: string, patch: TaskPatch) {
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    (set as Record<string, unknown>)[k] = k === 'dueDate' ? v || null : v;
  }
  const [row] = await db().update(tasks).set(set).where(eq(tasks.id, id)).returning();
  if (!row) throw new HttpError(404, 'That task was not found.');
  return row;
}

export async function deleteTask(id: string) {
  const [row] = await db().delete(tasks).where(eq(tasks.id, id)).returning();
  if (!row) throw new HttpError(404, 'That task was not found.');
  return row;
}

/**
 * Who, if anyone, should hear about this save: the new assignee, when the
 * assignee changed and the person saving is not assigning it to himself.
 */
export function assigneeToNotify(
  before: string | null,
  after: string | null | undefined,
  actorId: string,
): string | null {
  if (after === undefined || after === null) return null;
  if (after === before) return null;
  if (after === actorId) return null;
  return after;
}
