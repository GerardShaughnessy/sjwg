import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import {
  checkAssignees,
  createTask,
  listArchive,
  listAssignees,
  listTasks,
  taskView,
} from '@/server/db/queries/tasks';
import { parseOrThrow, resolveAssigneeIds, TASK_SECTIONS, taskSchema } from '@/server/schemas';
import { afterTaskSave } from '@/server/tasks';
import { assertTaskManager, isTaskManager, type AccountGroup } from '@/server/task-rules';

export const prerender = false;

const GROUP_IDS: AccountGroup[] = ['officers', 'board', 'tradesmen', 'vendors'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The board. Officers and the Admin get every task and everyone a task can
 * go to. Everyone else gets only the tasks they are on, and the names of the
 * people on them. Done tasks finished more than 7 days ago are left off;
 * `archived` counts them.
 *
 * ?archive=1 lists those older Done tasks instead, newest first, 50 at a
 * time (`offset`, and `next` in the reply). Optional filters: `q` (title and
 * notes), `section`, and for officers `person` and `view` (a group).
 */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const manager = isTaskManager(s);
  const onlyFor = manager ? undefined : s.userId;
  const p = ctx.url.searchParams;
  if (p.get('archive') === '1') {
    const section = p.get('section') ?? '';
    const person = p.get('person') ?? '';
    const view = p.get('view') as AccountGroup | null;
    const offset = Number(p.get('offset') ?? 0);
    const page = await listArchive({
      onlyFor,
      q: (p.get('q') ?? '').trim().slice(0, 200) || undefined,
      section: (TASK_SECTIONS as readonly string[]).includes(section) ? section : undefined,
      person: manager && UUID.test(person) ? person : undefined,
      group: manager && view && GROUP_IDS.includes(view) ? view : undefined,
      offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
    });
    const onTasks = [...new Set([...page.people, ...page.tasks.flatMap((t) => t.assigneeIds)])];
    const assignees = await listAssignees({ manager, onTasks });
    return json({ ...page, assignees, canManage: manager });
  }
  const { tasks, archived } = await listTasks(onlyFor);
  const onTasks = [...new Set(tasks.flatMap((t) => t.assigneeIds))];
  const assignees = await listAssignees({ manager, onTasks });
  return json({ tasks, assignees, canManage: manager, archived });
});

/** Officers only. Accepts assigneeIds, or the old single assigneeId. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  assertTaskManager(session);
  const input = parseOrThrow(taskSchema, await readJson(ctx));
  const ids = resolveAssigneeIds(input) ?? [];
  await checkAssignees(ids);
  const { row, inserted } = await createTask(input, ids, session.userId);
  const result = await afterTaskSave({ row, before: null, after: ids, inserted, actor: session });
  return json({ task: taskView(row, ids), ...result }, 201);
});
