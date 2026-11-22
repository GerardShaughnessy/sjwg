import { useEffect, useRef, useState } from 'react';
import { tasks as api, type Assignee, type Task, type TaskInput, type TaskStatus } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import type { Session } from '@/lib/types';
import {
  btnMuted,
  btnPrimary,
  btnSecondary,
  ErrorStrip,
  inputCls,
  Labeled,
  Loading,
  msg,
  Status,
} from '../ui';

const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'To do' },
  { id: 'doing', label: 'In progress' },
  { id: 'waiting', label: 'Waiting on someone' },
  { id: 'done', label: 'Done' },
];
const SECTIONS = ['Paperwork', '501(c)(3)', 'Money', 'Site launch', 'Content', 'General'];

const EMPTY: TaskInput = {
  title: '',
  notes: '',
  status: 'todo',
  section: 'General',
  assigneeIds: [],
  waitingOn: '',
  dueDate: '',
  sortOrder: 0,
};

const today = () => new Date().toISOString().slice(0, 10);
const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const personName = (a: Assignee | undefined) => a?.name || a?.email || 'Someone';
const initials = (a: Assignee | undefined) =>
  (a?.name || a?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** The officers' to-do board. Drag a card between columns, or click it to edit. */
export default function TasksBoard({ session }: { session: Session }) {
  const { data, loading, error } = useResource(() => api.list(), []);
  const [section, setSection] = useState('');
  const [mine, setMine] = useState(false);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [moved, setMoved] = useState<Record<string, TaskStatus>>({});
  const [status, setStatus] = useState('');
  const [boardError, setBoardError] = useState('');
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);
  const openedFromLink = useRef(false);

  const all = data?.tasks ?? [];
  const assignees = data?.assignees ?? [];
  const byId = new Map(assignees.map((a) => [a.id, a]));

  // ?task=<id> in an assignment email opens that card.
  useEffect(() => {
    if (openedFromLink.current || !data) return;
    openedFromLink.current = true;
    const id = new URLSearchParams(window.location.search).get('task');
    const t = id && data.tasks.find((x) => x.id === id);
    if (t) setEditing(t);
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

  if (loading && !data) return <Loading what="the task board" />;
  if (error && !data) return <ErrorStrip>{error}</ErrorStrip>;

  const visible = all
    .map((t) => (moved[t.id] ? { ...t, status: moved[t.id] } : t))
    .filter((t) => !section || t.section === section)
    .filter((t) => !mine || t.assigneeIds.includes(session.userId));

  async function move(t: Task, to: TaskStatus) {
    if (t.status === to) return;
    setBoardError('');
    setMoved((m) => ({ ...m, [t.id]: to }));
    try {
      await api.update(t.id, { status: to });
      setStatus(`Moved "${t.title}" to ${COLUMNS.find((c) => c.id === to)!.label}.`);
    } catch (err) {
      setMoved((m) => {
        const { [t.id]: _, ...rest } = m;
        return rest;
      });
      setBoardError(msg(err, 'Could not move that task.'));
    }
  }

  return (
    <div className="flex flex-col gap-5 font-sans">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2 font-serif">Tasks</h2>
          <p className="text-ash text-[0.95rem]">
            Drag a card to another column, or open it to edit. People you add to a task get an
            email. Moves show on the Dashboard instead.
          </p>
        </div>
        <button type="button" className={btnPrimary} onClick={() => setEditing('new')}>
          New task
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <label className="flex items-center gap-2">
          <span className="font-semibold">Section</span>
          <select value={section} onChange={(e) => setSection(e.target.value)} className={inputCls}>
            <option value="">All</option>
            {SECTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => setMine(e.target.checked)}
            className="accent-brick h-5 w-5"
          />
          <span className="font-semibold">Only mine</span>
        </label>
        <Status>{status}</Status>
      </div>
      {boardError && <ErrorStrip>{boardError}</ErrorStrip>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const cards = visible.filter((t) => t.status === col.id);
          return (
            <section
              key={col.id}
              aria-label={col.label}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.id);
              }}
              onDragLeave={() => setDragOver((d) => (d === col.id ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const t = all.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                if (t) move({ ...t, status: moved[t.id] ?? t.status }, col.id);
              }}
              className={`border-mortar flex min-h-40 flex-col gap-3 border-2 p-3 ${dragOver === col.id ? 'bg-paper border-brass' : 'bg-stone'}`}
            >
              <h3 className="flex items-baseline justify-between font-semibold">
                {col.label}
                <span className="text-ash text-[0.9rem] font-normal">{cards.length}</span>
              </h3>
              {cards.map((t) => (
                <Card
                  key={t.id}
                  task={t}
                  people={t.assigneeIds.map(
                    (id) => byId.get(id) ?? { id, name: null, email: 'Former officer' },
                  )}
                  onOpen={() => setEditing(t)}
                  onMove={(to) => move(t, to)}
                />
              ))}
              {cards.length === 0 && <p className="text-ash text-[0.9rem]">Nothing here.</p>}
            </section>
          );
        })}
      </div>

      {editing && (
        <TaskEditor
          task={editing === 'new' ? null : editing}
          assignees={assignees}
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

function Card({
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
  const overdue = t.dueDate && t.status !== 'done' && t.dueDate < today();
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', t.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`bg-paper border-charcoal flex cursor-grab flex-col gap-2 border-2 p-3 ${t.status === 'done' ? 'opacity-70' : ''}`}
    >
      <span className="text-brass-ink text-[0.8rem] font-semibold tracking-wide uppercase">
        {t.section}
      </span>
      <button
        type="button"
        onClick={onOpen}
        className={`text-left font-semibold hover:underline ${t.status === 'done' ? 'line-through' : ''}`}
      >
        {t.title}
      </button>
      {people.length > 0 && (
        <ul
          className="flex flex-wrap gap-1"
          aria-label={`Assigned to ${people.map(personName).join(', ')}`}
        >
          {people.map((p) => (
            <li
              key={p.id}
              title={personName(p)}
              className="bg-stone border-mortar text-charcoal flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-[0.75rem] font-semibold"
            >
              <span aria-hidden="true">{initials(p)}</span>
              <span className="sr-only">{personName(p)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="text-ash flex flex-wrap gap-x-3 gap-y-1 text-[0.85rem]">
        {people.length === 1 && <span>{personName(people[0])}</span>}
        {t.waitingOn && <span>Waiting on {t.waitingOn}</span>}
        {t.dueDate && (
          <span className={overdue ? 'text-brick font-semibold' : ''}>
            {overdue ? 'Overdue ' : 'Due '}
            {shortDate(t.dueDate)}
          </span>
        )}
      </div>
      <label className="sr-only" htmlFor={`move-${t.id}`}>
        Move "{t.title}"
      </label>
      <select
        id={`move-${t.id}`}
        value={t.status}
        onChange={(e) => onMove(e.target.value as TaskStatus)}
        className="border-mortar border px-2 py-1 text-[0.85rem]"
      >
        {COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </article>
  );
}

function TaskEditor({
  task,
  assignees,
  session,
  onClose,
}: {
  task: Task | null;
  assignees: Assignee[];
  session: Session;
  onClose: (note?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<TaskInput>(
    task
      ? {
          title: task.title,
          notes: task.notes,
          status: task.status,
          section: task.section,
          assigneeIds: task.assigneeIds,
          waitingOn: task.waitingOn,
          dueDate: task.dueDate,
          sortOrder: task.sortOrder,
        }
      : EMPTY,
  );
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    setFields({});
    try {
      const r = task ? await api.update(task.id, form) : await api.create(form);
      const nameOf = (id: string) => personName(assignees.find((a) => a.id === id));
      const sent = r.emailed.filter((e) => e.status === 'sent').map((e) => nameOf(e.id));
      const unsent = r.emailed.filter((e) => e.status !== 'sent').map((e) => nameOf(e.id));
      const mail =
        (sent.length ? ` Emailed ${sent.join(', ')}.` : '') +
        (unsent.length ? ` The email to ${unsent.join(', ')} did not go out.` : '');
      onClose(`${task ? 'Saved' : 'Added'} "${r.task.title}".${mail}`);
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setError(msg(err, 'Could not save.'));
      setPending(false);
    }
  }

  async function remove() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setPending(true);
    try {
      await api.remove(task.id);
      onClose(`Deleted "${task.title}".`);
    } catch (err) {
      setError(msg(err, 'Could not delete.'));
      setPending(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={() => onClose()}
      aria-labelledby="task-editor-title"
      className="bg-paper border-charcoal m-auto w-[min(40rem,94vw)] border-2 p-0 backdrop:bg-black/50"
    >
      <form onSubmit={save} className="flex flex-col gap-4 p-5 font-sans">
        <h2 id="task-editor-title" className="text-h3 font-serif">
          {task ? 'Edit task' : 'New task'}
        </h2>
        <Labeled label="Title" error={fields.title}>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputCls}
            maxLength={200}
            required
            autoFocus
          />
        </Labeled>
        <Labeled label="Notes" error={fields.notes}>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={6}
            className={inputCls}
          />
        </Labeled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Column" error={fields.status}>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as TaskStatus)}
              className={inputCls}
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Section" error={fields.section}>
            <select
              value={form.section}
              onChange={(e) => set('section', e.target.value)}
              className={inputCls}
            >
              {SECTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Due date" error={fields.dueDate}>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => set('dueDate', e.target.value)}
              className={inputCls}
            />
          </Labeled>
        </div>
        <fieldset className="flex flex-col gap-1">
          <legend className="font-semibold">Assigned to</legend>
          <span className="text-ash text-[0.9rem]">
            Each person you add gets an email. Nobody else does.
          </span>
          <ul className="border-mortar mt-1 grid max-h-52 gap-x-4 overflow-y-auto border p-2 sm:grid-cols-2">
            {[
              ...assignees,
              // Someone on the task who is no longer an active officer stays listed.
              ...form.assigneeIds
                .filter((id) => !assignees.some((a) => a.id === id))
                .map((id) => ({ id, name: 'Former officer', email: '' })),
            ].map((a) => (
              <li key={a.id}>
                <label className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    className="accent-brick h-5 w-5"
                    checked={form.assigneeIds.includes(a.id)}
                    onChange={(e) =>
                      set(
                        'assigneeIds',
                        e.target.checked
                          ? [...form.assigneeIds, a.id]
                          : form.assigneeIds.filter((x) => x !== a.id),
                      )
                    }
                  />
                  {personName(a)}
                  {a.id === session.userId ? ' (you)' : ''}
                </label>
              </li>
            ))}
          </ul>
          {fields.assigneeIds && (
            <span role="alert" className="text-brick text-[0.95rem] font-semibold">
              {fields.assigneeIds}
            </span>
          )}
        </fieldset>
        <Labeled
          label="Waiting on"
          hint="Someone without a login, like the pastor or the IRS."
          error={fields.waitingOn}
        >
          <input
            value={form.waitingOn}
            onChange={(e) => set('waitingOn', e.target.value)}
            className={inputCls}
            maxLength={120}
          />
        </Labeled>
        {error && <ErrorStrip>{error}</ErrorStrip>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending || !form.title.trim()} className={btnPrimary}>
            {pending ? 'Saving' : task ? 'Save' : 'Add task'}
          </button>
          <button type="button" onClick={() => onClose()} className={btnSecondary}>
            Cancel
          </button>
          {task && (
            <button type="button" onClick={remove} disabled={pending} className={btnMuted}>
              {confirmDelete ? 'Yes, delete it' : 'Delete'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
