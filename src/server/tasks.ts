import { INBOX } from '@/config/contact-routing';
import type { AppSession } from './auth/server';
import {
  addFinishedEvent,
  addTaskEvents,
  getAssignee,
  namesFor,
  wasFinished,
  type NewTaskEvent,
} from './db/queries/tasks';
import { confirmPlan, taskEmailPlan, type TaskStatus } from './task-rules';
import type { tasks } from './db/schema';
import { sendEmail } from './email/send';
import { taskAssigned, taskFinished } from './email/templates/task';

type Task = typeof tasks.$inferSelect;
export type SendStatus = 'sent' | 'failed' | 'skipped';

/** Emails an officer that they are now on a task. Returns the send status; never throws. */
export async function notifyAssignee(
  task: Task,
  assigneeId: string,
  assignedBy: string,
): Promise<SendStatus> {
  try {
    const who = await getAssignee(assigneeId);
    const res = await sendEmail({
      to: who.email,
      email: taskAssigned({
        id: task.id,
        title: task.title,
        notes: task.notes,
        section: task.section,
        dueDate: task.dueDate ?? '',
        assignedBy,
        name: who.name?.split(' ')[0] ?? '',
      }),
      template: 'task_assigned',
      related: { type: 'task', id: task.id },
    });
    return res.status;
  } catch (err) {
    console.error('[tasks] could not notify assignee', err);
    return 'failed';
  }
}

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
  /** One entry per person emailed about being added. */
  emailed: { id: string; status: SendStatus }[];
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

  const emailed = await Promise.all(
    plan.notify.map(async (id) => ({ id, status: await notifyAssignee(row, id, actor.name) })),
  );
  const finished = plan.finished ? await notifyFinished(row, actor.name) : null;
  return { emailed, finished };
}
