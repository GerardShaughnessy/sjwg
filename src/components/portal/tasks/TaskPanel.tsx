import { useEffect, useRef, useState } from 'react';
import { tasks as api, type Assignee, type Task, type TaskInput, type TaskStatus } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import type { Session } from '@/lib/types';
import { ErrorStrip, inputCls, msg, Status } from '../ui';
import { Badge, pBtn, pBtnQuiet, pLink } from '../layout';
import {
  Avatars,
  COLUMNS,
  dueState,
  formatMinutes,
  GROUPS,
  Icon,
  personName,
  primaryGroup,
  SECTIONS,
  shortDate,
  today,
} from './shared';

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

const fieldLabel = 'text-[0.8rem] font-semibold tracking-[0.1em] uppercase';

/**
 * The side panel for one task: a slide-over on wide screens, full screen on
 * phones. Officers edit everything. Everyone else on the task moves it, adds a
 * note, and logs time. Escape closes it and focus returns to the board.
 */
export default function TaskPanel({
  task,
  assignees,
  canManage,
  session,
  onClose,
}: {
  task: Task | null;
  assignees: Assignee[];
  canManage: boolean;
  session: Session;
  onClose: (note?: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  useEffect(() => {
    opener.current = document.activeElement;
    ref.current?.showModal();
    return () => {
      const el = opener.current as HTMLElement | null;
      if (el && document.contains(el)) el.focus();
    };
  }, []);

  const people = (task?.assigneeIds ?? []).map(
    (id) =>
      assignees.find((a) => a.id === id) ?? {
        id,
        name: 'Former account',
        email: '',
        groups: [],
        detail: '',
        disabled: true,
      },
  );
  const due = task ? dueState(task) : null;

  return (
    <dialog
      ref={ref}
      onClose={() => onClose()}
      aria-labelledby="task-panel-title"
      className="bg-paper text-charcoal sm:border-l-charcoal m-0 ml-auto h-dvh max-h-none w-full max-w-none border-0 p-0 backdrop:bg-black/45 sm:w-[34rem] sm:border-l-2"
    >
      <div className="flex h-full flex-col font-sans">
        <header className="border-mortar bg-stone/60 flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="text-brass-ink text-[0.75rem] font-semibold tracking-[0.14em] uppercase">
              {task ? `${task.section} task` : 'New task'}
            </p>
            <h2 id="task-panel-title" className="font-serif text-[1.5rem] leading-tight">
              {task ? task.title : 'Add a task'}
            </h2>
            {task && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  tone={
                    task.status === 'done'
                      ? 'done'
                      : task.status === 'waiting'
                        ? 'waiting'
                        : 'neutral'
                  }
                >
                  {COLUMNS.find((c) => c.id === task.status)!.label}
                </Badge>
                {task.dueDate && (
                  <Badge
                    tone={due === 'overdue' ? 'attention' : due === 'soon' ? 'waiting' : 'neutral'}
                  >
                    {due === 'overdue' ? 'Overdue, ' : 'Due '}
                    {shortDate(task.dueDate)}
                  </Badge>
                )}
                {task.minutes > 0 && (
                  <Badge tone="neutral">{formatMinutes(task.minutes)} logged</Badge>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="border-mortar hover:border-charcoal rounded-sm border p-1.5"
          >
            <Icon name="close" className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {canManage ? (
            <EditForm task={task} assignees={assignees} session={session} onClose={onClose} />
          ) : task ? (
            <AssigneeView task={task} people={people} />
          ) : null}
          {task && !canManage && <AddNote task={task} />}
          {task && <TimeSection task={task} session={session} canManage={canManage} />}
        </div>
      </div>
    </dialog>
  );
}

/* ------------------------------------------------------------ officers */
function EditForm({
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
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    setFields({});
    try {
      const r = task ? await api.update(task.id, form) : await api.create(form);
      const names = r.queued.map((id) => personName(assignees.find((a) => a.id === id)));
      const mail = names.length
        ? ` ${names.join(', ')} will get an email in about 15 minutes.`
        : '';
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

  const err = (k: string) =>
    fields[k] ? (
      <span role="alert" className="text-[0.9rem] font-semibold text-[#7c2d1f]">
        {fields[k]}
      </span>
    ) : null;

  return (
    <form onSubmit={save} className="flex flex-col gap-4 px-5 py-5">
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Title</span>
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          className={inputCls}
          maxLength={200}
          required
          autoFocus={!task}
        />
        {err('title')}
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Column</span>
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
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Section</span>
          <select
            value={form.section}
            onChange={(e) => set('section', e.target.value)}
            className={inputCls}
          >
            {SECTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Due date</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
            className={inputCls}
          />
          {err('dueDate')}
        </label>
      </div>
      <PeoplePicker
        assignees={assignees}
        value={form.assigneeIds}
        onChange={(ids) => set('assigneeIds', ids)}
        me={session.userId}
        error={fields.assigneeIds}
      />
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={5}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabel}>Waiting on</span>
        <span className="text-ash text-[0.85rem]">
          Someone without a login, like the pastor or the IRS.
        </span>
        <input
          value={form.waitingOn}
          onChange={(e) => set('waitingOn', e.target.value)}
          className={inputCls}
          maxLength={120}
        />
      </label>
      {error && <ErrorStrip>{error}</ErrorStrip>}
      <div className="border-mortar bg-paper sticky bottom-0 -mx-5 flex flex-wrap items-center gap-3 border-t px-5 py-3">
        <button type="submit" disabled={pending || !form.title.trim()} className={pBtn}>
          {pending ? 'Saving…' : task ? 'Save' : 'Add task'}
        </button>
        <button type="button" onClick={() => onClose()} className={pBtnQuiet}>
          Cancel
        </button>
        {task && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-ash ml-auto px-1 text-[0.9rem] font-semibold underline underline-offset-4 hover:text-[#7c2d1f]"
          >
            {confirmDelete ? 'Yes, delete it' : 'Delete'}
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Who a task is for: a searchable checklist grouped by Officers, Board,
 * Tradesmen, and Vendors. Each person is listed once, under their first group.
 */
function PeoplePicker({
  assignees,
  value,
  onChange,
  me,
  error,
}: {
  assignees: Assignee[];
  value: string[];
  onChange: (ids: string[]) => void;
  me: string;
  error?: string;
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const pickable = assignees.filter((a) => !a.disabled || value.includes(a.id));
  const missing = value
    .filter((id) => !assignees.some((a) => a.id === id))
    .map((id) => ({
      id,
      name: 'Former account',
      email: '',
      groups: [],
      detail: '',
      disabled: true,
    }));
  const match = (a: Assignee) =>
    !query || personName(a).toLowerCase().includes(query) || a.detail.toLowerCase().includes(query);
  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...value, id] : value.filter((x) => x !== id));
  const chosen = [...pickable, ...missing].filter((a) => value.includes(a.id));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={fieldLabel}>Assigned to</legend>
      <p className="text-ash -mt-1 text-[0.85rem]">
        Anyone with an account. Each person you add gets one email about 15 minutes later, covering
        every task they were given in that time.
      </p>
      {chosen.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Chosen">
          {chosen.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => toggle(a.id, false)}
                className="bg-stone border-mortar hover:border-charcoal inline-flex items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-2.5 text-[0.85rem] font-semibold"
              >
                {personName(a)}
                <Icon name="close" className="h-3.5 w-3.5" />
                <span className="sr-only">, remove</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <span className="text-ash pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
          <Icon name="search" />
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
          className="border-mortar bg-paper focus:border-brass w-full rounded-sm border py-1.5 pr-2 pl-8 text-[0.95rem]"
        />
      </div>
      <div className="border-mortar max-h-64 overflow-y-auto rounded-sm border">
        {[
          ...GROUPS.map((g) => ({ ...g, list: pickable.filter((a) => primaryGroup(a) === g.id) })),
          { id: 'former', label: 'Former accounts', list: missing as Assignee[] },
        ]
          .map((g) => ({ ...g, list: g.list.filter(match) }))
          .filter((g) => g.list.length > 0)
          .map((g) => (
            <div key={g.id} role="group" aria-labelledby={`pick-${g.id}`}>
              <p
                id={`pick-${g.id}`}
                className="bg-stone text-ash sticky top-0 px-3 py-1 text-[0.72rem] font-semibold tracking-[0.14em] uppercase"
              >
                {g.label}
              </p>
              <ul>
                {g.list.map((a) => (
                  <li key={a.id}>
                    <label className="hover:bg-stone/60 flex cursor-pointer items-center gap-2.5 px-3 py-1.5">
                      <input
                        type="checkbox"
                        className="accent-brick h-4.5 w-4.5"
                        checked={value.includes(a.id)}
                        onChange={(e) => toggle(a.id, e.target.checked)}
                      />
                      <span className="min-w-0 flex-1">
                        {personName(a)}
                        {a.id === me ? ' (you)' : ''}
                      </span>
                      <span className="text-ash truncate text-[0.8rem]">{a.detail}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        {pickable.filter(match).length === 0 && (
          <p className="text-ash px-3 py-2 text-[0.9rem]">No one matches "{q}".</p>
        )}
      </div>
      {error && (
        <span role="alert" className="text-[0.9rem] font-semibold text-[#7c2d1f]">
          {error}
        </span>
      )}
    </fieldset>
  );
}

/* ------------------------------------------------- someone on the task */
function AssigneeView({ task, people }: { task: Task; people: Assignee[] }) {
  const [status, setStatus] = useState(task.status);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  async function move(to: TaskStatus) {
    const was = status;
    setStatus(to);
    setErr('');
    try {
      await api.update(task.id, { status: to });
      setNote(`Moved to ${COLUMNS.find((c) => c.id === to)!.label}.`);
    } catch (e) {
      setStatus(was);
      setErr(msg(e, 'Could not move it.'));
    }
  }
  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <label className="flex max-w-[16rem] flex-col gap-1">
        <span className={fieldLabel}>Column</span>
        <select
          value={status}
          onChange={(e) => move(e.target.value as TaskStatus)}
          className={inputCls}
        >
          {COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {err && <ErrorStrip>{err}</ErrorStrip>}
      <Status>{note}</Status>
      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-[0.95rem]">
        <dt className="text-ash">People</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <Avatars people={people} />
          <span>{people.map(personName).join(', ')}</span>
        </dd>
        {task.waitingOn && (
          <>
            <dt className="text-ash">Waiting on</dt>
            <dd>{task.waitingOn}</dd>
          </>
        )}
      </dl>
      <div>
        <p className={fieldLabel}>Notes</p>
        {task.notes.trim() ? (
          <p className="border-brass mt-1 border-l-4 py-1 pl-3 whitespace-pre-wrap">{task.notes}</p>
        ) : (
          <p className="text-ash mt-1">No notes yet.</p>
        )}
      </div>
    </div>
  );
}

function AddNote({ task }: { task: Task }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.update(task.id, { addNote: text });
      setText('');
      setNote('Note added.');
    } catch (e2) {
      setErr(msg(e2, 'Could not add the note.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={add} className="border-mortar flex flex-col gap-2 border-t px-5 py-5">
      <label htmlFor="task-add-note" className={fieldLabel}>
        Add a note
      </label>
      <textarea
        id="task-add-note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        className={inputCls}
        placeholder="What changed, or what you need."
      />
      <div>
        <button type="submit" className={pBtnQuiet} disabled={busy || !text.trim()}>
          {busy ? 'Adding…' : 'Add note'}
        </button>
      </div>
      {err && <ErrorStrip>{err}</ErrorStrip>}
      <Status>{note}</Status>
    </form>
  );
}

/* ---------------------------------------------------------------- time */
function TimeSection({
  task,
  session,
  canManage,
}: {
  task: Task;
  session: Session;
  canManage: boolean;
}) {
  const { data, error } = useResource(() => api.time(task.id), [task.id]);
  const [hours, setHours] = useState('');
  const [mins, setMins] = useState('');
  const [day, setDay] = useState(today());
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const entries = data ?? [];
  const total = entries.reduce((n, e) => n + e.minutes, 0);
  const perPerson = [
    ...entries.reduce(
      (m, e) => m.set(e.name, (m.get(e.name) ?? 0) + e.minutes),
      new Map<string, number>(),
    ),
  ].sort((a, b) => b[1] - a[1]);

  async function log(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const h = Number(hours || 0);
      const m = Number(mins || 0);
      await api.logTime(task.id, { hours: h, minutes: m, workedOn: day, note: text });
      setNote(`Logged ${formatMinutes(h * 60 + m)}.`);
      setHours('');
      setMins('');
      setText('');
    } catch (e2) {
      setErr(msg(e2, 'Could not log that time.'));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setErr('');
    try {
      await api.deleteTime(id);
      setNote('Time entry deleted.');
    } catch (e2) {
      setErr(msg(e2, 'Could not delete that entry.'));
    }
  }

  return (
    <section
      aria-labelledby="task-time-title"
      className="border-mortar flex flex-col gap-4 border-t px-5 py-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="task-time-title" className="flex items-center gap-2 font-serif text-[1.2rem]">
          <Icon name="clock" className="h-5 w-5" />
          Time
        </h3>
        <span className="font-semibold">{formatMinutes(total)} total</span>
      </div>
      <form
        onSubmit={log}
        className="bg-stone/50 border-mortar grid gap-3 rounded-md border p-3 sm:grid-cols-[5rem_5rem_1fr]"
      >
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Hours</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={24}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className={`${inputCls} py-1.5`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={5}
            value={mins}
            onChange={(e) => setMins(e.target.value)}
            className={`${inputCls} py-1.5`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabel}>Date</span>
          <input
            type="date"
            value={day}
            max={today()}
            onChange={(e) => setDay(e.target.value)}
            className={`${inputCls} py-1.5`}
            required
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-3">
          <span className={fieldLabel}>
            Note <span className="text-ash font-normal normal-case">(optional)</span>
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            className={`${inputCls} py-1.5`}
            placeholder="What you worked on"
          />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            className={pBtn}
            disabled={busy || (!Number(hours) && !Number(mins))}
          >
            {busy ? 'Logging…' : 'Log time'}
          </button>
        </div>
      </form>
      {err && <ErrorStrip>{err}</ErrorStrip>}
      {error && <ErrorStrip>{error}</ErrorStrip>}
      <Status>{note}</Status>
      {perPerson.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Time per person">
          {perPerson.map(([name, m]) => (
            <li
              key={name}
              className="border-mortar bg-paper rounded-full border px-3 py-0.5 text-[0.85rem]"
            >
              <span className="font-semibold">{name}</span> {formatMinutes(m)}
            </li>
          ))}
        </ul>
      )}
      {entries.length === 0 ? (
        <p className="text-ash text-[0.95rem]">No time logged yet.</p>
      ) : (
        <ul className="divide-mortar flex flex-col divide-y text-[0.95rem]">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p>
                  <span className="font-semibold">{formatMinutes(e.minutes)}</span>
                  <span className="text-ash">
                    {' '}
                    · {e.name} · {shortDate(e.workedOn)}
                  </span>
                </p>
                {e.note && <p className="text-ash text-[0.9rem]">{e.note}</p>}
              </div>
              {(canManage || e.userId === session.userId) && (
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  className={`${pLink} shrink-0 text-[0.85rem]`}
                >
                  Delete
                  <span className="sr-only">
                    {' '}
                    {formatMinutes(e.minutes)} on {shortDate(e.workedOn)}
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
