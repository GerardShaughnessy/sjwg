import { and, asc, desc, eq, inArray, isNull, sql, sum } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, taskAssignees, taskEvents, taskNotifications, taskTime, tasks } from '../schema';
import { HttpError, badRequest } from '../../http';
import { accountGroups, type AccountGroup } from '../../task-rules';
import type { z } from 'astro/zod';
import type { taskPatchSchema, taskSchema } from '../../schemas';

type TaskInput = z.output<typeof taskSchema>;
type TaskPatch = z.output<typeof taskPatchSchema>;
type TaskRow = typeof tasks.$inferSelect;

export function taskView(t: TaskRow, assigneeIds: string[], minutes = 0) {
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
    /** Total time logged on the task. */
    minutes,
  };
}

/** Assignee ids per task, in the order they were added (user id breaks ties). */
async function assigneeMap(taskIds?: string[]) {
  if (taskIds && taskIds.length === 0) return new Map<string, string[]>();
  const q = db()
    .select({ taskId: taskAssignees.taskId, userId: taskAssignees.userId })
    .from(taskAssignees);
  const rows = await (taskIds ? q.where(inArray(taskAssignees.taskId, taskIds)) : q).orderBy(
    asc(taskAssignees.addedAt),
    asc(taskAssignees.userId),
  );
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.taskId, [...(m.get(r.taskId) ?? []), r.userId]);
  return m;
}

export async function getAssigneeIds(taskId: string): Promise<string[]> {
  return (await assigneeMap([taskId])).get(taskId) ?? [];
}

/** Minutes logged per task. */
async function minutesMap(taskIds?: string[]) {
  if (taskIds && taskIds.length === 0) return new Map<string, number>();
  const q = db()
    .select({ taskId: taskTime.taskId, n: sum(taskTime.minutes) })
    .from(taskTime)
    .groupBy(taskTime.taskId);
  const rows = await (taskIds ? q.where(inArray(taskTime.taskId, taskIds)) : q);
  return new Map(rows.map((r) => [r.taskId, Number(r.n ?? 0)]));
}

/** Every task (officers), or only the tasks with `onlyFor` on them. */
export async function listTasks(onlyFor?: string) {
  const ids = onlyFor
    ? (
        await db()
          .select({ taskId: taskAssignees.taskId })
          .from(taskAssignees)
          .where(eq(taskAssignees.userId, onlyFor))
      ).map((r) => r.taskId)
    : undefined;
  if (ids && ids.length === 0) return [];
  const q = db().select().from(tasks);
  const [rows, byTask, mins] = await Promise.all([
    (ids ? q.where(inArray(tasks.id, ids)) : q).orderBy(asc(tasks.sortOrder), asc(tasks.createdAt)),
    assigneeMap(ids),
    minutesMap(ids),
  ]);
  return rows.map((t) => taskView(t, byTask.get(t.id) ?? [], mins.get(t.id) ?? 0));
}

export interface AssigneeView {
  id: string;
  name: string | null;
  email: string;
  groups: AccountGroup[];
  /** "Admin", the officer title, the board title, the trade, or the service. */
  detail: string;
  disabled: boolean;
}

/**
 * People for the board. Officers get every enabled account (anyone can be
 * assigned) plus anyone already on a task. Others get only the people on
 * their own tasks, without email addresses.
 */
export async function listAssignees(opts: { manager: boolean; onTasks: string[] }) {
  const rows = await db()
    .select({
      id: appUsers.id,
      name: appUsers.name,
      email: appUsers.email,
      role: appUsers.role,
      siteAdmin: appUsers.siteAdmin,
      title: appUsers.title,
      director: appUsers.director,
      boardTitle: appUsers.boardTitle,
      vendor: appUsers.vendor,
      vendorService: appUsers.vendorService,
      memberId: appUsers.memberId,
      disabled: appUsers.disabled,
    })
    .from(appUsers)
    .orderBy(asc(appUsers.name), asc(appUsers.email));
  const onTasks = new Set(opts.onTasks);
  return rows
    .filter((u) => (opts.manager ? !u.disabled || onTasks.has(u.id) : onTasks.has(u.id)))
    .map((u): AssigneeView => ({
      id: u.id,
      name: u.name,
      email: opts.manager ? u.email : '',
      groups: accountGroups(u),
      detail:
        u.role === 'admin' && u.siteAdmin
          ? 'Admin'
          : u.role === 'admin'
            ? u.title || 'Officer'
            : u.director
              ? u.boardTitle || 'Director'
              : u.vendor
                ? u.vendorService || 'Vendor'
                : 'Tradesman',
      disabled: u.disabled,
    }));
}

/**
 * Checks newly added people have enabled accounts. People already on the
 * task may stay even if their account has since been disabled.
 */
export async function checkAssignees(ids: string[], keep: string[] = []) {
  const fresh = ids.filter((id) => !keep.includes(id));
  if (fresh.length === 0) return;
  const ok = await db()
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(and(inArray(appUsers.id, fresh), eq(appUsers.disabled, false)));
  if (ok.length !== fresh.length)
    throw badRequest('Pick people with an enabled account.', {
      assigneeIds: 'Pick people with an enabled account.',
    });
}

/** True when this person is on this task. */
export async function isOnTask(taskId: string, userId: string): Promise<boolean> {
  const [row] = await db()
    .select({ u: taskAssignees.userId })
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, taskId), eq(taskAssignees.userId, userId)))
    .limit(1);
  return Boolean(row);
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

/**
 * Inserts people onto a task and returns the ids actually inserted. Someone
 * already on it (a double click, two officers at once) is skipped, so they
 * are only ever emailed once.
 */
async function insertAssignees(taskId: string, userIds: string[], addedBy: string) {
  if (userIds.length === 0) return [];
  const rows = await db()
    .insert(taskAssignees)
    .values(userIds.map((userId) => ({ taskId, userId, addedBy })))
    .onConflictDoNothing()
    .returning({ userId: taskAssignees.userId });
  return rows.map((r) => r.userId);
}

/** Returns the task and the assignee ids actually inserted. */
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
  const inserted = await insertAssignees(row.id, assigneeIds, createdBy);
  return { row, inserted };
}

/**
 * Saves the fields in `patch`. `assigneeIds` replaces the list when given.
 * Returns the task and the assignee ids this save actually inserted.
 */
export async function updateTask(
  id: string,
  patch: TaskPatch,
  assigneeIds: string[] | undefined,
  actorId: string,
  /** A stamped note line to append to the current notes (when `notes` is not also set). */
  o: { appendLine?: string } = {},
) {
  const { assigneeIds: _ids, assigneeId: _id, addNote: _note, ...rest } = patch;
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(rest)) {
    if (v === undefined) continue;
    (set as Record<string, unknown>)[k] = k === 'dueDate' ? v || null : v;
  }
  if (assigneeIds) set.assigneeId = assigneeIds[0] ?? null;
  // Appended in SQL, so two notes added at once both land (appendNote's rules).
  if (o.appendLine !== undefined && rest.notes === undefined)
    (set as Record<string, unknown>).notes =
      sql`case when ${tasks.notes} ~ '^\\s*$' then ${o.appendLine}::text else regexp_replace(${tasks.notes}, '\\s+$', '') || E'\\n\\n' || ${o.appendLine}::text end`;
  const [row] = await db().update(tasks).set(set).where(eq(tasks.id, id)).returning();
  if (!row) throw new HttpError(404, 'That task was not found.');
  let inserted: string[] = [];
  if (assigneeIds) {
    const before = await getAssigneeIds(id);
    const gone = before.filter((u) => !assigneeIds.includes(u));
    const fresh = assigneeIds.filter((u) => !before.includes(u));
    if (gone.length) {
      await db()
        .delete(taskAssignees)
        .where(and(eq(taskAssignees.taskId, id), inArray(taskAssignees.userId, gone)));
      // Taken off before the batched email went out: nothing to tell them.
      await db()
        .delete(taskNotifications)
        .where(
          and(
            eq(taskNotifications.taskId, id),
            inArray(taskNotifications.userId, gone),
            isNull(taskNotifications.sentAt),
          ),
        );
    }
    inserted = await insertAssignees(id, fresh, actorId);
  }
  return { row, inserted };
}

export const TASK_HAS_TIME =
  'This task has logged time. Move it to Done instead, or remove the time entries first.';

/**
 * Delete a task. Unless `force`, a task with logged time is refused (409) in
 * the same statement, so time logged a moment ago is never lost by accident.
 */
export async function deleteTask(id: string, o: { force?: boolean } = {}) {
  const noTime = sql`not exists (select 1 from ${taskTime} where ${taskTime.taskId} = ${tasks.id})`;
  const [row] = await db()
    .delete(tasks)
    .where(o.force ? eq(tasks.id, id) : and(eq(tasks.id, id), noTime))
    .returning();
  if (row) return row;
  const [still] = await db().select({ id: tasks.id }).from(tasks).where(eq(tasks.id, id)).limit(1);
  if (still) throw new HttpError(409, TASK_HAS_TIME);
  throw new HttpError(404, 'That task was not found.');
}

/* ---------------------------------------------------------------- events */
export type TaskEventType =
  'created' | 'moved' | 'assigned' | 'unassigned' | 'finished' | 'deleted' | 'time_logged';

export interface NewTaskEvent {
  taskId: string | null;
  type: TaskEventType;
  actor: { userId: string; name: string };
  fromStatus?: string | null;
  toStatus?: string | null;
  meta: {
    title: string;
    names?: string[];
    userIds?: string[];
    self?: boolean;
    taskId?: string;
    minutes?: number;
  };
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

/**
 * Logs the one 'finished' event a task can have. Returns false when one
 * already exists (unique index task_events_finished_once), in which case the
 * hello@ email must not go out again.
 */
export async function addFinishedEvent(e: NewTaskEvent): Promise<boolean> {
  const rows = await db()
    .insert(taskEvents)
    .values({
      taskId: e.taskId,
      type: 'finished',
      actorId: e.actor.userId,
      actorName: e.actor.name.split(' ')[0] || e.actor.name,
      fromStatus: e.fromStatus ?? null,
      toStatus: 'done',
      meta: e.meta,
    })
    .onConflictDoNothing()
    .returning({ id: taskEvents.id });
  return rows.length > 0;
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

/* ------------------------------------------------------- batched emails */
/**
 * Queue the "added to a task" email for each person. One unsent row per
 * person and task (a partial unique index), so adding someone twice in the
 * window queues them once.
 */
export async function queueTaskNotifications(taskId: string, userIds: string[], addedBy: string) {
  if (userIds.length === 0) return [];
  const rows = await db()
    .insert(taskNotifications)
    .values(userIds.map((userId) => ({ userId, taskId, addedBy })))
    .onConflictDoNothing()
    .returning({ userId: taskNotifications.userId });
  return rows.map((r) => r.userId);
}

/* ---------------------------------------------------------------- time */
export interface TimeEntryView {
  id: string;
  taskId: string;
  taskTitle?: string;
  userId: string | null;
  name: string;
  minutes: number;
  workedOn: string;
  note: string;
  createdAt: string;
}

const personName = (name: string | null, email: string | null) => name || email || 'Former account';

export async function listTaskTime(taskId: string): Promise<TimeEntryView[]> {
  const rows = await db()
    .select({ t: taskTime, name: appUsers.name, email: appUsers.email })
    .from(taskTime)
    .leftJoin(appUsers, eq(appUsers.id, taskTime.userId))
    .where(eq(taskTime.taskId, taskId))
    .orderBy(desc(taskTime.workedOn), desc(taskTime.createdAt));
  return rows.map(({ t, name, email }) => ({
    id: t.id,
    taskId: t.taskId,
    userId: t.userId,
    name: personName(name, email),
    minutes: t.minutes,
    workedOn: t.workedOn,
    note: t.note ?? '',
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function addTaskTime(input: {
  taskId: string;
  userId: string;
  minutes: number;
  workedOn: string;
  note: string;
}) {
  const [row] = await db().insert(taskTime).values(input).returning();
  return row;
}

export async function getTimeEntry(id: string) {
  const [row] = await db().select().from(taskTime).where(eq(taskTime.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That time entry was not found.');
  return row;
}

export async function deleteTimeEntry(id: string) {
  await db().delete(taskTime).where(eq(taskTime.id, id));
}

export interface TimeSummaryRow {
  userId: string | null;
  name: string;
  monthMinutes: number;
  totalMinutes: number;
}

/**
 * Hours per person, this month and all time. `monthStart` is the first of
 * this month on the Guild's clock. `person` narrows it to one account.
 */
export async function timeSummary(monthStart: string, person?: string) {
  const where = person ? eq(taskTime.userId, person) : undefined;
  const [people, recent] = await Promise.all([
    db()
      .select({
        userId: taskTime.userId,
        name: appUsers.name,
        email: appUsers.email,
        total: sum(taskTime.minutes),
        month: sql<string>`coalesce(sum(${taskTime.minutes}) filter (where ${taskTime.workedOn} >= ${monthStart}::date), 0)`,
      })
      .from(taskTime)
      .leftJoin(appUsers, eq(appUsers.id, taskTime.userId))
      .where(where)
      .groupBy(taskTime.userId, appUsers.name, appUsers.email),
    db()
      .select({ t: taskTime, name: appUsers.name, email: appUsers.email, title: tasks.title })
      .from(taskTime)
      .innerJoin(tasks, eq(tasks.id, taskTime.taskId))
      .leftJoin(appUsers, eq(appUsers.id, taskTime.userId))
      .where(where)
      .orderBy(desc(taskTime.workedOn), desc(taskTime.createdAt))
      .limit(50),
  ]);
  return {
    people: people
      .map((p): TimeSummaryRow => ({
        userId: p.userId,
        name: personName(p.name, p.email),
        monthMinutes: Number(p.month ?? 0),
        totalMinutes: Number(p.total ?? 0),
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes),
    recent: recent.map(({ t, name, email, title }): TimeEntryView => ({
      id: t.id,
      taskId: t.taskId,
      taskTitle: title,
      userId: t.userId,
      name: personName(name, email),
      minutes: t.minutes,
      workedOn: t.workedOn,
      note: t.note ?? '',
      createdAt: t.createdAt.toISOString(),
    })),
  };
}
