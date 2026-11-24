/** Pure rules for the task board: who may do what, who hears about a save, and how the feed reads it. */
import { HttpError } from './http';
export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  waiting: 'Waiting',
  done: 'Done',
};

/* ------------------------------------------------------------------ archive */
/** Done tasks stay on the board this long after they are finished, then move to the Archive. */
export const ARCHIVE_AFTER_DAYS = 7;
const DAY_MS = 24 * 3600 * 1000;

/** Tasks finished before this moment are archived. */
export const archiveCutoff = (now = new Date()) =>
  new Date(now.getTime() - ARCHIVE_AFTER_DAYS * DAY_MS);

/**
 * True when a task belongs on the board: anything not Done, or Done within
 * the last 7 days. `finishedAt` is ISO, or null for a task that is not Done.
 */
export function onBoard(
  t: { status: TaskStatus; finishedAt: string | null },
  now = new Date(),
): boolean {
  if (t.status !== 'done' || !t.finishedAt) return true;
  return Date.parse(t.finishedAt) >= archiveCutoff(now).getTime();
}

/* ------------------------------------------------------------ who may do what */
type Who = { userId: string; role: 'admin' | 'member' };

/** Officers and the Admin see and manage every task. Everyone else works their own. */
export const isTaskManager = (s: Who) => s.role === 'admin';

/** Fields someone on a task may change without being an officer: the column, and a note. */
export const ASSIGNEE_PATCH_FIELDS = ['status', 'addNote'] as const;

/**
 * A save on a task. Officers may change anything. Anyone else must be on the
 * task and may only move it or add a note: no title, due date, or people.
 */
export function assertTaskPatchAllowed(s: Who, onTask: boolean, fields: string[]): void {
  if (isTaskManager(s)) return;
  if (!onTask) throw new HttpError(404, 'That task was not found.');
  const extra = fields.filter((f) => !(ASSIGNEE_PATCH_FIELDS as readonly string[]).includes(f));
  if (extra.length)
    throw new HttpError(
      403,
      'Only an officer can change that. You can move the task or add a note.',
    );
}

/** Creating, deleting, and assigning tasks. */
export function assertTaskManager(s: Who): void {
  if (!isTaskManager(s)) throw new HttpError(403, 'Only an officer can do that.');
}

/** Logging time: people on the task, or any officer. */
export function assertCanLogTime(s: Who, onTask: boolean): void {
  if (isTaskManager(s)) return;
  if (!onTask) throw new HttpError(403, 'You can log time only on your own tasks.');
}

/** Deleting a time entry: your own, or any if you are an officer. */
export function assertCanDeleteTime(s: Who, entry: { userId: string | null }): void {
  if (isTaskManager(s)) return;
  if (entry.userId !== s.userId)
    throw new HttpError(403, 'You can delete only your own time entries.');
}

/** "2h", "1h 30m", "45m" */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** A note added to a task, stamped with who wrote it and when. */
export function noteLine(by: string, text: string, day: string): string {
  return `${by}, ${day}: ${text.trim()}`;
}

export function appendNote(notes: string, by: string, text: string, day: string): string {
  const line = noteLine(by, text, day);
  return notes.trim() ? `${notes.trimEnd()}\n\n${line}` : line;
}

/* --------------------------------------------------------- account groups */
export type AccountGroup = 'officers' | 'board' | 'tradesmen' | 'vendors';
export const GROUP_LABEL: Record<AccountGroup, string> = {
  officers: 'Officers',
  board: 'Board',
  tradesmen: 'Tradesmen',
  vendors: 'Vendors',
};

/**
 * Which views a person counts toward. A person can be in several (an officer
 * on the board). Officers include the Admin. A tradesman is any other account
 * with a directory entry, or with no other role.
 */
export function accountGroups(u: {
  role: 'admin' | 'member';
  director: boolean;
  vendor: boolean;
  memberId: string | null;
}): AccountGroup[] {
  const g: AccountGroup[] = [];
  if (u.role === 'admin') g.push('officers');
  if (u.director) g.push('board');
  if (u.role === 'member' && (u.memberId || (!u.vendor && !u.director))) g.push('tradesmen');
  if (u.vendor) g.push('vendors');
  return g;
}

/* ------------------------------------------------------ batched assignments */
/** A new assignment waits this long, so several land in one email. */
export const DIGEST_WAIT_MS = 15 * 60 * 1000;

export interface PendingNotification {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  disabled: boolean;
  /** False when the person was taken off the task since. */
  stillAssigned: boolean;
  taskId: string;
  title: string;
  dueDate: string | null;
  addedByName: string | null;
  createdAt: Date;
  /** True when the task is already Done at send time: nothing to tell them. */
  done?: boolean;
}

/** A digest row is claimed (and its email tried) at most this many times. */
export const MAX_DIGEST_ATTEMPTS = 5;

export interface TaskDigest {
  userId: string;
  email: string;
  name: string | null;
  /** The notification rows this email covers. */
  ids: string[];
  items: {
    notificationId: string;
    taskId: string;
    title: string;
    dueDate: string | null;
    addedBy: string | null;
  }[];
}

/**
 * Who gets an email now. Rows for disabled people, tasks they were taken
 * off, and tasks already Done are dropped (and marked handled). The rest are grouped by person; a
 * person is ready once their OLDEST unsent row is 15 minutes old, and then
 * every pending task of theirs goes in one email.
 */
export function planTaskDigests(
  rows: PendingNotification[],
  now: Date,
): { digests: TaskDigest[]; discard: string[] } {
  const discard: string[] = [];
  const byUser = new Map<string, PendingNotification[]>();
  for (const r of rows) {
    if (r.disabled || !r.stillAssigned || !r.email || r.done) {
      discard.push(r.id);
      continue;
    }
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  }
  const digests: TaskDigest[] = [];
  for (const [userId, list] of byUser) {
    const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (now.getTime() - sorted[0].createdAt.getTime() < DIGEST_WAIT_MS) continue;
    digests.push({
      userId,
      email: sorted[0].email,
      name: sorted[0].name,
      ids: sorted.map((r) => r.id),
      items: sorted.map((r) => ({
        notificationId: r.id,
        taskId: r.taskId,
        title: r.title,
        dueDate: r.dueDate,
        addedBy: r.addedByName,
      })),
    });
  }
  return { digests, discard };
}

export interface TaskEmailPlan {
  /** People newly on the task. */
  added: string[];
  /** People taken off the task. */
  removed: string[];
  /** Who is queued for the batched task-assigned email: everyone added except the actor. */
  notify: string[];
  /** True when hello@ gets the one "finished" email. */
  finished: boolean;
}

/**
 * The only emails a task save sends: each newly added person (not the actor)
 * gets the task-assigned email, and the first move into Done sends one email
 * to hello@. `fromStatus` is null on create. `alreadyFinished` is true when
 * an earlier "finished" event exists, so moving out of Done and back is quiet.
 */
export function taskEmailPlan(o: {
  before: string[];
  after: string[] | undefined;
  actorId: string;
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus;
  alreadyFinished: boolean;
}): TaskEmailPlan {
  const before = new Set(o.before);
  const after = o.after === undefined ? before : new Set(o.after);
  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  return {
    added,
    removed,
    notify: added.filter((id) => id !== o.actorId),
    finished: o.toStatus === 'done' && o.fromStatus !== 'done' && !o.alreadyFinished,
  };
}

/**
 * Narrows a plan to what the database confirmed: only people whose
 * task_assignees row this save inserted are emailed (and logged as added),
 * and hello@ hears only when this save's 'finished' event was the one
 * inserted. A duplicate add or a second finish racing the first sends nothing.
 */
export function confirmPlan(
  plan: TaskEmailPlan,
  db: { inserted: string[]; finishedLogged: boolean },
): TaskEmailPlan {
  const inserted = new Set(db.inserted);
  return {
    ...plan,
    added: plan.added.filter((id) => inserted.has(id)),
    notify: plan.notify.filter((id) => inserted.has(id)),
    finished: plan.finished && db.finishedLogged,
  };
}

/** "Sam", "Sam and Milton", "Sam, Milton, and Greg" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

export interface TaskEventLike {
  type: string;
  actorName: string;
  toStatus: string | null;
  meta: { title?: string; names?: string[]; self?: boolean; minutes?: number };
}

/** One feed line for a task event, or null for a type the feed does not show. */
export function taskEventText(e: TaskEventLike): string | null {
  const who = e.actorName || 'Someone';
  const title = `'${e.meta.title ?? 'a task'}'`;
  const names = e.meta.names ?? [];
  switch (e.type) {
    case 'created':
      if (names.length === 1 && names[0] === e.actorName)
        return `${who} added ${title} and took it.`;
      return names.length
        ? `${who} added ${title} for ${joinNames(names)}.`
        : `${who} added ${title}.`;
    case 'moved':
      return `${who} moved ${title} to ${STATUS_LABEL[e.toStatus as TaskStatus] ?? e.toStatus}.`;
    case 'finished':
      return `${who} finished ${title}.`;
    case 'assigned':
      return e.meta.self && names.length === 1
        ? `${who} took ${title}.`
        : `${who} assigned ${title} to ${joinNames(names)}.`;
    case 'unassigned':
      return `${who} took ${joinNames(names)} off ${title}.`;
    case 'deleted':
      return `${who} deleted ${title}.`;
    case 'time_logged':
      return `${who} logged ${formatMinutes(e.meta.minutes ?? 0)} on ${title}.`;
    default:
      return null;
  }
}
