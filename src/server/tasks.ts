import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { INBOX } from '@/config/contact-routing';
import type { AppSession } from './auth/server';
import { db } from './db/client';
import {
  addFinishedEvent,
  addTaskEvents,
  namesFor,
  queueTaskNotifications,
  wasFinished,
  type NewTaskEvent,
} from './db/queries/tasks';
import {
  confirmPlan,
  planTaskDigests,
  taskEmailPlan,
  type PendingNotification,
  type TaskStatus,
} from './task-rules';
import { appUsers, taskAssignees, taskNotifications, tasks } from './db/schema';
import { sendEmail } from './email/send';
import { taskFinished, tasksAssignedBatch } from './email/templates/task';

type Task = typeof tasks.$inferSelect;
export type SendStatus = 'sent' | 'failed' | 'skipped';

/** One email to hello@ the first time a task reaches Done. Never throws. */
export async function notifyFinished(task: Task, by: string): Promise<SendStatus> {
  try {
    const res = await sendEmail({
      to: INBOX.hello,
      email: taskFinished({ id: task.id, title: task.title, section: task.section, by }),
      template: 'task_finished',
      related: { type: 'task', id: task.id },
    });
    return res.status;
  } catch (err) {
    console.error('[tasks] could not send the finished email', err);
    return 'failed';
  }
}

export interface TaskSaveResult {
  /** People queued for the batched "new task" email (sent about 15 minutes later). */
  queued: string[];
  /** Status of the hello@ email, when the task was finished for the first time. */
  finished: SendStatus | null;
}

/**
 * After a task is created or saved: write the feed events and send exactly
 * the emails taskEmailPlan allows, narrowed by confirmPlan to what the
 * database actually inserted. `before` is null on create; `inserted` is the
 * assignee ids this save inserted.
 */
export async function afterTaskSave(o: {
  row: Task;
  before: { status: TaskStatus; assigneeIds: string[] } | null;
  after: string[] | undefined;
  inserted: string[];
  actor: AppSession;
}): Promise<TaskSaveResult> {
  const { row, before, actor } = o;
  const from = before?.status ?? null;
  const statusChanged = from !== row.status;
  const alreadyFinished =
    before && statusChanged && row.status === 'done' ? await wasFinished(row.id) : false;
  const draft = taskEmailPlan({
    before: before?.assigneeIds ?? [],
    after: o.after,
    actorId: actor.userId,
    fromStatus: from,
    toStatus: row.status,
    alreadyFinished,
  });
  const by = { userId: actor.userId, name: actor.name };
  const meta = { title: row.title };

  // The finished event goes in first and alone: the unique index lets only
  // one save win, and only the winner emails hello@.
  let finishedLogged = false;
  if (draft.finished)
    finishedLogged = await addFinishedEvent({
      taskId: row.id,
      type: 'finished',
      actor: by,
      fromStatus: from,
      toStatus: 'done',
      meta,
    }).catch((err) => {
      console.error('[tasks] could not log the finish', err);
      return false;
    });
  const plan = confirmPlan(draft, { inserted: o.inserted, finishedLogged });

  const events: NewTaskEvent[] = [];
  if (!before) {
    events.push({
      taskId: row.id,
      type: 'created',
      actor: by,
      toStatus: row.status,
      meta: { ...meta, userIds: plan.added, names: await namesFor(plan.added) },
    });
  } else {
    if (plan.added.length)
      events.push({
        taskId: row.id,
        type: 'assigned',
        actor: by,
        meta: {
          ...meta,
          userIds: plan.added,
          names: await namesFor(plan.added),
          self: plan.added.length === 1 && plan.added[0] === actor.userId,
        },
      });
    if (plan.removed.length)
      events.push({
        taskId: row.id,
        type: 'unassigned',
        actor: by,
        meta: { ...meta, userIds: plan.removed, names: await namesFor(plan.removed) },
      });
    if (statusChanged && !plan.finished)
      events.push({
        taskId: row.id,
        type: 'moved',
        actor: by,
        fromStatus: from,
        toStatus: row.status,
        meta,
      });
  }
  await addTaskEvents(events).catch((err) => console.error('[tasks] could not log events', err));

  const queued = await queueTaskNotifications(row.id, plan.notify, actor.userId).catch((err) => {
    console.error('[tasks] could not queue the assignment emails', err);
    return [] as string[];
  });
  const finished = plan.finished ? await notifyFinished(row, actor.name) : null;
  return { queued, finished };
}

/**
 * The scheduled job (netlify/functions/task-digest). One email per person
 * whose oldest unsent row is 15 minutes old, listing every pending task.
 * Rows are claimed with UPDATE ... WHERE sent_at IS NULL RETURNING before
 * the email goes out, so two runs at once never send the same task twice.
 */
export async function sendTaskDigests(now = new Date()) {
  const adder = alias(appUsers, 'adder');
  const rows = await db()
    .select({
      id: taskNotifications.id,
      userId: taskNotifications.userId,
      email: appUsers.email,
      name: appUsers.name,
      disabled: appUsers.disabled,
      stillAssigned: sql<boolean>`exists (select 1 from ${taskAssignees} where ${taskAssignees.taskId} = ${taskNotifications.taskId} and ${taskAssignees.userId} = ${taskNotifications.userId})`,
      taskId: taskNotifications.taskId,
      title: tasks.title,
      dueDate: tasks.dueDate,
      addedByName: adder.name,
      createdAt: taskNotifications.createdAt,
    })
    .from(taskNotifications)
    .innerJoin(appUsers, eq(appUsers.id, taskNotifications.userId))
    .innerJoin(tasks, eq(tasks.id, taskNotifications.taskId))
    .leftJoin(adder, eq(adder.id, taskNotifications.addedBy))
    .where(isNull(taskNotifications.sentAt));
  const pending: PendingNotification[] = rows.map((r) => ({
    ...r,
    stillAssigned: Boolean(r.stillAssigned),
    createdAt: r.createdAt ?? now,
  }));
  const { digests, discard } = planTaskDigests(pending, now);

  const claim = (ids: string[]) =>
    ids.length
      ? db()
          .update(taskNotifications)
          .set({ sentAt: now })
          .where(and(inArray(taskNotifications.id, ids), isNull(taskNotifications.sentAt)))
          .returning({ id: taskNotifications.id })
      : Promise.resolve([] as { id: string }[]);

  // Disabled people and tasks they were taken off: marked handled, never emailed.
  await claim(discard);

  let sent = 0;
  let failed = 0;
  for (const d of digests) {
    const won = new Set((await claim(d.ids)).map((r) => r.id));
    const items = d.items.filter((i) => won.has(i.notificationId));
    if (items.length === 0) continue;
    const res = await sendEmail({
      to: d.email,
      email: tasksAssignedBatch({
        name: d.name?.split(' ')[0] ?? '',
        items: items.map((i) => ({
          id: i.taskId,
          title: i.title,
          dueDate: i.dueDate ?? '',
          assignedBy: i.addedBy ?? '',
        })),
      }),
      template: items.length === 1 ? 'task_assigned' : 'tasks_assigned',
      related: { type: 'task', id: items[0].taskId },
    }).catch((err) => {
      console.error('[task-digest] send failed for', d.userId, err);
      return { status: 'failed' as const };
    });
    if (res.status === 'sent') sent++;
    else failed++;
  }
  return { people: digests.length, sent, failed, discarded: discard.length };
}
