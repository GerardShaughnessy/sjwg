import { getAssignee } from './db/queries/tasks';
import type { tasks } from './db/schema';
import { sendEmail } from './email/send';
import { taskAssigned } from './email/templates/task';

/** Emails an officer that a task is now his. Returns the send status; never throws. */
export async function notifyAssignee(
  task: typeof tasks.$inferSelect,
  assigneeId: string,
  assignedBy: string,
): Promise<'sent' | 'failed' | 'skipped'> {
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
