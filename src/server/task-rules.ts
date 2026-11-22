/** Pure rules for the task board: who hears about a save, and how the feed reads it. */
export type TaskStatus = 'todo' | 'doing' | 'waiting' | 'done';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To do',
  doing: 'In progress',
  waiting: 'Waiting on someone',
  done: 'Done',
};

export interface TaskEmailPlan {
  /** People newly on the task. */
  added: string[];
  /** People taken off the task. */
  removed: string[];
  /** Who gets the task-assigned email: everyone added except the actor. */
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
  meta: { title?: string; names?: string[]; self?: boolean };
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
    default:
      return null;
  }
}
