import { useEffect, useMemo, useRef, useState } from 'react';
import { tasks as api, type Assignee, type Task, type TaskStatus } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import type { Session } from '@/lib/types';
import { ErrorStrip, Loading, msg } from '../ui';
import { pBtn, TONE } from '../layout';
import TaskPanel from './TaskPanel';
import {
  Avatars,
  chip,
  COLUMNS,
  columnLabel,
  dueState,
  type Filters,
  formatMinutes,
  GROUPS,
  Icon,
  PersonCombo,
  personName,
  readFilters,
  SECTIONS,
  shortDate,
  type View,
  writeFilters,
} from './shared';

const NO_FILTERS: Filters = {
  view: 'all',
  person: '',
  mine: false,
  overdue: false,
  section: '',
  q: '',
};

/**
 * The task board. Officers and the Admin see and manage every task; everyone
 * else sees the tasks they are on, moves them, adds notes, and logs time.
 * Drag a card between columns, or use its Move menu (keyboard and phones).
 */
export default function TasksBoard({
  session,
  onArchive,
}: {
  session: Session;
  /** Opens the Archive sub-tab. */
  onArchive?: () => void;
}) {
  const { data, loading, error, refetch } = useResource(() => api.list(), []);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [moved, setMoved] = useState<Record<string, TaskStatus>>({});
  const [status, setStatus] = useState('');
  const [boardError, setBoardError] = useState('');
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const openedFromLink = useRef(false);
  const columnRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setFilters(readFilters());
    setReady(true);
  }, []);
  useEffect(() => {
    // The Archive search is not on the board: leave it alone.
    if (ready) writeFilters({ ...filters, q: undefined });
  }, [filters, ready]);

  const all = data?.tasks ?? [];
  const canManage = data?.canManage ?? false;
  const assignees = data?.assignees ?? [];
  const byId = useMemo(() => new Map(assignees.map((a) => [a.id, a])), [assignees]);
  const peopleOn = (t: Task): Assignee[] =>
    t.assigneeIds.map(
      (id) =>
        byId.get(id) ?? {
          id,
          name: 'Former account',
          email: '',
          groups: [],
          detail: '',
          disabled: true,
        },
    );

  // ?task=<id> in an assignment email opens that card.
  useEffect(() => {
    if (openedFromLink.current || !data) return;
    openedFromLink.current = true;
    const id = new URLSearchParams(window.location.search).get('task');
    if (id && data.tasks.some((x) => x.id === id)) setEditing(id);
  }, [data]);

  // Drop local overrides once the server agrees.
  useEffect(() => {
    if (!data) return;
    setMoved((m) => {
      const next = { ...m };
      for (const t of data.tasks) if (next[t.id] === t.status) delete next[t.id];
      return next;
    });
  }, [data]);

  function openTask(id: string | 'new' | null) {
    setEditing(id);
    const p = new URLSearchParams(window.location.search);
    if (id && id !== 'new') p.set('task', id);
    else p.delete('task');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p}`);
  }

  if (loading && !data) return <Loading what="the task board" />;
  if (error && !data) return <ErrorStrip onRetry={refetch}>{error}</ErrorStrip>;

  const current = all.map((t) => (moved[t.id] ? { ...t, status: moved[t.id] } : t));
  const inView = (t: Task, view: View) =>
    view === 'all' || t.assigneeIds.some((id) => byId.get(id)?.groups.includes(view));
  const visible = current.filter(
    (t) =>
      inView(t, filters.view) &&
      (!filters.person || t.assigneeIds.includes(filters.person)) &&
      (!filters.mine || t.assigneeIds.includes(session.userId)) &&
      (!filters.overdue || dueState(t) === 'overdue') &&
      (!filters.section || t.section === filters.section),
  );
  const withTasks = new Set(all.flatMap((t) => t.assigneeIds));
  const personOptions = assignees
    .filter((a) => withTasks.has(a.id))
    .map((a) => ({ id: a.id, name: personName(a), detail: a.detail }));
  const filtered =
    filters.view !== 'all' || filters.person || filters.mine || filters.overdue || filters.section;
  const overdueCount = current.filter((t) => dueState(t) === 'overdue').length;
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  async function move(t: Task, to: TaskStatus) {
    if (t.status === to) return;
    setBoardError('');
    setMoved((m) => ({ ...m, [t.id]: to }));
    try {
      await api.update(t.id, { status: to });
      setStatus(`Moved "${t.title}" to ${columnLabel(to)}.`);
    } catch (err) {
      setMoved((m) => {
        const { [t.id]: _, ...rest } = m;
        return rest;
      });
      setBoardError(msg(err, 'Could not move that task.'));
    }
  }

  const editingTask = editing && editing !== 'new' ? current.find((t) => t.id === editing) : null;

  return (
    <div className="flex flex-col gap-5 font-sans">
      {/* Toolbar: views, filters, and the add button */}
      <div className="border-mortar bg-paper flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canManage ? (
            <div role="group" aria-label="Show tasks for" className="flex flex-wrap gap-2">
              {[{ id: 'all' as View, label: 'All' }, ...GROUPS].map((g) => {
                const n = current.filter((t) => inView(t, g.id)).length;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={filters.view === g.id}
                    onClick={() => set({ view: g.id })}
                    className={chip(filters.view === g.id)}
                  >
                    {g.label}
                    <span className={filters.view === g.id ? 'text-paper/80' : 'text-ash'}>
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-ash text-[0.95rem]">
              Tasks you are on. Move them as you go, add notes, and log your time.
            </p>
          )}
          {canManage && (
            <button type="button" className={`${pBtn} gap-1.5`} onClick={() => openTask('new')}>
              <Icon name="plus" />
              New task
            </button>
          )}
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,16rem)_minmax(10rem,12rem)_1fr]">
          {canManage ? (
            <PersonCombo
              id="task-person"
              label="Person"
              people={personOptions}
              value={filters.person}
              onChange={(person) => set({ person })}
            />
          ) : (
            <span className="hidden lg:block" />
          )}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="task-section"
              className="text-[0.8rem] font-semibold tracking-[0.1em] uppercase"
            >
              Section
            </label>
            <select
              id="task-section"
              value={filters.section}
              onChange={(e) => set({ section: e.target.value })}
              className="border-mortar bg-paper rounded-sm border px-2 py-1.5 text-[0.95rem]"
            >
              <option value="">All sections</option>
              {SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-1 lg:justify-end">
            {canManage && (
              <button
                type="button"
                aria-pressed={filters.mine}
                onClick={() => set({ mine: !filters.mine })}
                className={chip(filters.mine)}
              >
                My tasks
              </button>
            )}
            <button
              type="button"
              aria-pressed={filters.overdue}
              onClick={() => set({ overdue: !filters.overdue })}
              className={chip(filters.overdue)}
            >
              Overdue
              <span className={filters.overdue ? 'text-paper/80' : 'text-[#7c2d1f]'}>
                {overdueCount}
              </span>
            </button>
            {filtered && (
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="text-ash decoration-mortar hover:text-charcoal px-1 text-[0.9rem] font-semibold underline underline-offset-4"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {status && (
        <p className="text-ash -mt-2 text-[0.9rem]" aria-hidden="true">
          {status}
        </p>
      )}
      {boardError && <ErrorStrip>{boardError}</ErrorStrip>}

      {/* Phones: jump to a column. The columns scroll sideways and snap. */}
      <nav aria-label="Columns" className="relative -mt-1 flex gap-2 overflow-x-auto xl:hidden">
        {COLUMNS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() =>
              columnRefs.current[c.id]?.scrollIntoView({
                behavior: 'smooth',
                inline: 'start',
                block: 'nearest',
              })
            }
            className="border-mortar bg-paper flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[0.85rem] font-semibold"
          >
            <span className={`h-2 w-2 rounded-full ${c.dot}`} aria-hidden="true" />
            {c.label}
            <span className="text-ash">{visible.filter((t) => t.status === c.id).length}</span>
          </button>
        ))}
      </nav>

      <div className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 md:-mx-0 md:scroll-px-0 md:px-0 xl:grid xl:grid-cols-4 xl:overflow-visible">
        {COLUMNS.map((col) => {
          const cards = visible.filter((t) => t.status === col.id);
          const headId = `col-${col.id}`;
          return (
            <section
              key={col.id}
              ref={(el) => {
                columnRefs.current[col.id] = el;
              }}
              aria-labelledby={headId}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('text/plain')) return;
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const t = current.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                if (t) move(t, col.id);
              }}
              className={`flex w-[86%] max-w-[24rem] shrink-0 snap-start flex-col rounded-md border transition-colors xl:w-auto xl:max-w-none ${
                dragOver === col.id ? 'border-brass bg-paper' : 'border-mortar bg-[#efe5cc]/60'
              }`}
            >
              <header className="border-mortar flex items-center justify-between gap-2 border-b px-3.5 py-3">
                <h3
                  id={headId}
                  className="flex items-center gap-2 font-sans text-[0.8rem] font-semibold tracking-[0.14em] uppercase"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} aria-hidden="true" />
                  {col.label}
                  <span className="sr-only">
                    , {cards.length} {cards.length === 1 ? 'task' : 'tasks'}
                  </span>
                </h3>
                <span
                  aria-hidden="true"
                  className="bg-paper border-mortar min-w-7 rounded-full border px-2 text-center text-[0.8rem] font-semibold"
                >
                  {cards.length}
                </span>
              </header>
              {cards.length === 0 ? (
                <p className="text-ash px-3.5 py-6 text-center text-[0.9rem]">
                  {filtered ? 'Nothing matches here.' : col.hint}
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5 p-2.5">
                  {cards.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      people={peopleOn(t)}
                      onOpen={() => openTask(t.id)}
                      onMove={(to) => move(t, to)}
                    />
                  ))}
                </ul>
              )}
              {col.id === 'done' && (data?.archived ?? 0) > 0 && (
                <p className="border-mortar border-t px-3.5 py-2.5 text-[0.85rem]">
                  <a
                    href="?sub=archive"
                    onClick={(e) => {
                      if (!onArchive) return;
                      e.preventDefault();
                      onArchive();
                    }}
                    className="text-ash hover:text-charcoal decoration-mortar font-semibold underline underline-offset-4"
                  >
                    Older finished tasks are in the Archive ({data!.archived})
                  </a>
                </p>
              )}
            </section>
          );
        })}
      </div>

      {editing && (
        <TaskPanel
          key={editing}
          task={editing === 'new' ? null : (editingTask ?? null)}
          assignees={assignees}
          canManage={canManage}
          session={session}
          onClose={(note) => {
            openTask(null);
            if (note) setStatus(note);
          }}
        />
      )}
    </div>
  );
}

function TaskCard({
  task: t,
  people,
  onOpen,
  onMove,
}: {
  task: Task;
  people: Assignee[];
  onOpen: () => void;
  onMove: (to: TaskStatus) => void;
}) {
  const due = dueState(t);
  const titleId = `task-title-${t.id}`;
  const dueTone = due === 'overdue' ? TONE.attention : due === 'soon' ? TONE.waiting : TONE.neutral;
  return (
    <li>
      <article
        aria-labelledby={titleId}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', t.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        className={`border-mortar bg-paper hover:border-brass focus-within:border-brass group flex cursor-grab flex-col rounded-md border shadow-[0_1px_0_rgba(67,64,42,0.08)] active:cursor-grabbing ${
          due === 'overdue' ? 'border-l-4 border-l-[#a8432f]' : ''
        } ${t.status === 'done' ? 'opacity-75' : ''}`}
      >
        <div className="flex items-start justify-between gap-2 px-3 pt-3">
          <span className="text-brass-ink text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
            {t.section}
          </span>
          {t.dueDate && (
            <span
              className={`rounded-full border px-2 py-px text-[0.75rem] font-semibold whitespace-nowrap ${dueTone}`}
            >
              {due === 'overdue' ? 'Overdue, ' : 'Due '}
              {shortDate(t.dueDate)}
            </span>
          )}
        </div>
        <h4 className="px-3 pt-1.5 font-serif leading-snug">
          <button
            id={titleId}
            type="button"
            onClick={onOpen}
            className={`text-left text-[1rem] font-semibold decoration-2 underline-offset-4 hover:underline ${t.status === 'done' ? 'line-through' : ''}`}
          >
            {t.title}
          </button>
        </h4>
        {t.waitingOn && (
          <p className="text-ash px-3 pt-1 text-[0.85rem]">Waiting on {t.waitingOn}</p>
        )}
        <div className="border-mortar/70 mt-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t px-3 py-2">
          <Avatars people={people} />
          <div className="text-ash flex items-center gap-3 text-[0.8rem] font-semibold">
            {t.notes.trim() && (
              <span className="flex items-center gap-1" title="Has notes">
                <Icon name="note" />
                <span className="sr-only">Has notes</span>
              </span>
            )}
            {t.minutes > 0 && (
              <span className="flex items-center gap-1 whitespace-nowrap" title="Time logged">
                <Icon name="clock" />
                <span className="sr-only">Time logged:</span>
                {formatMinutes(t.minutes)}
              </span>
            )}
            <label className="sr-only" htmlFor={`move-${t.id}`}>
              Move "{t.title}" to
            </label>
            <select
              id={`move-${t.id}`}
              value={t.status}
              onChange={(e) => onMove(e.target.value as TaskStatus)}
              className="border-mortar text-charcoal hover:border-brass max-w-[6.5rem] rounded-sm border bg-transparent px-1 py-0.5 text-[0.8rem]"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </article>
    </li>
  );
}
