import { useEffect, useMemo, useState } from 'react';
import { tasks as api, type Assignee, type Task } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import type { Session } from '@/lib/types';
import { ErrorStrip, Loading, msg } from '../ui';
import { pBtnQuiet } from '../layout';
import TaskPanel from './TaskPanel';
import {
  Avatars,
  chip,
  formatMinutes,
  GROUPS,
  Icon,
  PersonCombo,
  personName,
  readFilters,
  SECTIONS,
  type View,
  writeFilters,
} from './shared';

interface ArchiveFilters {
  view: View;
  person: string;
  section: string;
  q: string;
}
const NONE: ArchiveFilters = { view: 'all', person: '', section: '', q: '' };

const finishedDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  });

/**
 * Done tasks finished more than 7 days ago, newest first, 50 at a time.
 * Same filters as the board, plus a search of titles and notes. Opening a
 * task shows the usual panel; moving it out of Done puts it back on the board.
 */
export default function TasksArchive({ session }: { session: Session }) {
  const [filters, setFilters] = useState<ArchiveFilters>(NONE);
  const [search, setSearch] = useState('');
  const [ready, setReady] = useState(false);
  const [extra, setExtra] = useState<{ tasks: Task[]; assignees: Assignee[]; next: number | null }>(
    { tasks: [], assignees: [], next: null },
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const f = readFilters();
    setFilters({ view: f.view, person: f.person, section: f.section, q: f.q });
    setSearch(f.q);
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) writeFilters(filters);
  }, [filters, ready]);
  // Search as you type, a moment after the typing stops.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = {
    q: filters.q.trim(),
    section: filters.section,
    person: filters.person,
    view: filters.view === 'all' ? '' : filters.view,
  };
  const { data, loading, error } = useResource(
    () => (ready ? api.archive(query) : new Promise<never>(() => {})),
    [ready, query.q, query.section, query.person, query.view],
  );
  // A fresh first page (new filters, or a save anywhere) drops the extra pages.
  useEffect(() => {
    setExtra({ tasks: [], assignees: [], next: null });
    setMoreError('');
  }, [data]);

  const canManage = data?.canManage ?? false;
  const assignees = useMemo(() => {
    const m = new Map<string, Assignee>();
    for (const a of [...(data?.assignees ?? []), ...extra.assignees]) m.set(a.id, a);
    return [...m.values()];
  }, [data, extra.assignees]);
  const byId = useMemo(() => new Map(assignees.map((a) => [a.id, a])), [assignees]);

  if (!data && (loading || !ready)) return <Loading what="the archive" />;
  if (error && !data) return <ErrorStrip>{error}</ErrorStrip>;
  if (!data) return null;

  const seen = new Set<string>();
  const rows = [...data.tasks, ...extra.tasks].filter((t) =>
    seen.has(t.id) ? false : (seen.add(t.id), true),
  );
  const next = extra.tasks.length ? extra.next : data.next;
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
  const personOptions = data.people
    .map((id) => byId.get(id))
    .filter((a): a is Assignee => Boolean(a))
    .map((a) => ({ id: a.id, name: personName(a), detail: a.detail }));
  const filtered = filters.view !== 'all' || filters.person || filters.section || filters.q.trim();
  const set = (patch: Partial<ArchiveFilters>) => setFilters((f) => ({ ...f, ...patch }));

  async function loadMore() {
    if (next == null) return;
    setLoadingMore(true);
    setMoreError('');
    try {
      const page = await api.archive({ ...query, offset: next });
      setExtra((e) => ({
        tasks: [...e.tasks, ...page.tasks],
        assignees: [...e.assignees, ...page.assignees],
        next: page.next,
      }));
    } catch (err) {
      setMoreError(msg(err, 'Could not load more.'));
    } finally {
      setLoadingMore(false);
    }
  }

  // Keep the panel open on the task even once a save moves it off this list.
  const editingTask = editing ? (rows.find((t) => t.id === editing.id) ?? editing) : null;

  return (
    <div className="flex flex-col gap-5 font-sans">
      <div className="border-mortar bg-paper flex flex-col gap-4 rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canManage ? (
            <div role="group" aria-label="Show tasks for" className="flex flex-wrap gap-2">
              {[{ id: 'all' as View, label: 'All' }, ...GROUPS].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={filters.view === g.id}
                  onClick={() => set({ view: g.id })}
                  className={chip(filters.view === g.id)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          ) : null}
          <p className="text-ash text-[0.95rem]">
            Finished more than 7 days ago, newest first. Move a task out of Done to put it back on
            the board.
          </p>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_minmax(12rem,16rem)_minmax(10rem,12rem)_auto]">
          <div className="flex min-w-0 flex-col gap-1">
            <label
              htmlFor="archive-q"
              className="text-[0.8rem] font-semibold tracking-[0.1em] uppercase"
            >
              Search
            </label>
            <div className="relative">
              <span className="text-ash pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
                <Icon name="search" />
              </span>
              <input
                id="archive-q"
                type="search"
                value={search}
                placeholder="Titles and notes"
                onChange={(e) => setSearch(e.target.value)}
                className="border-mortar bg-paper focus:border-brass w-full min-w-0 rounded-sm border py-1.5 pr-2 pl-8 text-[0.95rem]"
              />
            </div>
          </div>
          {canManage ? (
            <PersonCombo
              id="archive-person"
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
              htmlFor="archive-section"
              className="text-[0.8rem] font-semibold tracking-[0.1em] uppercase"
            >
              Section
            </label>
            <select
              id="archive-section"
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
          {filtered && (
            <div className="flex min-h-[2.1rem] items-center lg:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilters(NONE);
                }}
                className="text-ash decoration-mortar hover:text-charcoal px-1 text-[0.9rem] font-semibold underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}
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

      {rows.length === 0 ? (
        <p className="border-mortar bg-paper text-ash rounded-md border px-4 py-8 text-center">
          {filtered ? 'Nothing in the Archive matches.' : 'Nothing in the Archive yet.'}
        </p>
      ) : (
        <div className="border-mortar bg-paper overflow-hidden rounded-md border">
          <div
            aria-hidden="true"
            className="border-mortar text-ash hidden grid-cols-[1fr_8rem_8rem_5rem] gap-4 border-b px-4 py-2 text-[0.75rem] font-semibold tracking-[0.12em] uppercase md:grid"
          >
            <span>Task</span>
            <span>People</span>
            <span>Finished</span>
            <span className="text-right">Time</span>
          </div>
          <ul aria-label="Archived tasks" className="divide-mortar/70 divide-y">
            {rows.map((t) => (
              <li
                key={t.id}
                className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 md:grid-cols-[1fr_8rem_8rem_5rem]"
              >
                <div className="col-span-2 min-w-0 md:col-span-1">
                  <span className="text-brass-ink block text-[0.7rem] font-semibold tracking-[0.12em] uppercase md:mr-2 md:inline">
                    {t.section}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="text-left font-serif text-[1rem] font-semibold decoration-2 underline-offset-4 hover:underline"
                  >
                    {t.title}
                  </button>
                </div>
                <div className="flex items-center gap-3 md:contents">
                  <Avatars people={peopleOn(t)} size="h-6 w-6" />
                  <span className="text-ash md:text-charcoal text-[0.85rem] md:text-[0.9rem]">
                    <span className="md:sr-only">Finished </span>
                    {t.finishedAt ? (
                      <time dateTime={t.finishedAt}>{finishedDate(t.finishedAt)}</time>
                    ) : (
                      'Unknown'
                    )}
                  </span>
                </div>
                <span className="text-ash flex items-center justify-end gap-1 text-[0.85rem] font-semibold whitespace-nowrap">
                  {t.minutes > 0 ? (
                    <>
                      <Icon name="clock" />
                      <span className="sr-only">Time logged:</span>
                      {formatMinutes(t.minutes)}
                    </>
                  ) : (
                    'No time'
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {moreError && <ErrorStrip>{moreError}</ErrorStrip>}
      {next != null && (
        <div className="flex justify-center">
          <button type="button" className={pBtnQuiet} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading' : 'Load more'}
          </button>
        </div>
      )}

      {editingTask && (
        <TaskPanel
          key={editingTask.id}
          task={editingTask}
          assignees={assignees}
          canManage={canManage}
          session={session}
          onClose={(note) => {
            setEditing(null);
            if (note) setStatus(note);
          }}
        />
      )}
    </div>
  );
}
