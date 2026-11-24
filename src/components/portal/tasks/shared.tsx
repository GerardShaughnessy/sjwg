import { useEffect, useState } from 'react';
import type { AccountGroup, Assignee, Task, TaskStatus } from '@/lib/api';

/** Shared pieces for the task board, its panel, and the time summary. */
export const COLUMNS: { id: TaskStatus; label: string; dot: string; hint: string }[] = [
  { id: 'todo', label: 'To do', dot: 'bg-mortar', hint: 'Not started yet.' },
  { id: 'doing', label: 'Doing', dot: 'bg-brick', hint: 'Someone is on it.' },
  { id: 'waiting', label: 'Waiting', dot: 'bg-brass', hint: 'Waiting on someone else.' },
  { id: 'done', label: 'Done', dot: 'bg-[#4f7a48]', hint: 'Finished.' },
];
export const columnLabel = (id: TaskStatus) => COLUMNS.find((c) => c.id === id)!.label;

export const SECTIONS = ['Paperwork', '501(c)(3)', 'Money', 'Site launch', 'Content', 'General'];

export const GROUPS: { id: AccountGroup; label: string }[] = [
  { id: 'officers', label: 'Officers' },
  { id: 'board', label: 'Board' },
  { id: 'tradesmen', label: 'Tradesmen' },
  { id: 'vendors', label: 'Vendors' },
];

export type View = 'all' | AccountGroup;
export interface Filters {
  view: View;
  person: string;
  mine: boolean;
  overdue: boolean;
  section: string;
  /** Archive search (title and notes). */
  q: string;
}

/**
 * Filters live in the address bar, so a reload or a shared link keeps them.
 * The board and the Archive share view, person, and section.
 */
export function readFilters(): Filters {
  const p = new URLSearchParams(window.location.search);
  const view = p.get('view') as View | null;
  return {
    view: view && (view === 'all' || GROUPS.some((g) => g.id === view)) ? view : 'all',
    person: p.get('person') ?? '',
    mine: p.get('mine') === '1',
    overdue: p.get('overdue') === '1',
    section: SECTIONS.includes(p.get('section') ?? '') ? p.get('section')! : '',
    q: p.get('q') ?? '',
  };
}
export function writeFilters(f: Partial<Filters>) {
  const p = new URLSearchParams(window.location.search);
  const set = (k: string, v: string | false) => (v ? p.set(k, v) : p.delete(k));
  if (f.view !== undefined) set('view', f.view !== 'all' && f.view);
  if (f.person !== undefined) set('person', f.person);
  if (f.mine !== undefined) set('mine', f.mine && '1');
  if (f.overdue !== undefined) set('overdue', f.overdue && '1');
  if (f.section !== undefined) set('section', f.section);
  if (f.q !== undefined) set('q', f.q.trim());
  window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p}`);
}

export const chip = (on: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-[0.9rem] font-semibold whitespace-nowrap ${
    on
      ? 'bg-brick border-brick text-paper'
      : 'border-mortar bg-paper text-charcoal hover:border-brass'
  }`;

/** Today on the Guild's clock, as YYYY-MM-DD. */
export function today(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const DAY = 24 * 3600 * 1000;
const dayNum = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / DAY;

/** Overdue is red; due within 3 days is mustard. Done tasks are never late. */
export function dueState(t: Pick<Task, 'dueDate' | 'status'>): 'overdue' | 'soon' | 'later' | null {
  if (!t.dueDate) return null;
  if (t.status === 'done') return 'later';
  const diff = Math.round(dayNum(t.dueDate) - dayNum(today()));
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return 'later';
}

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export const personName = (a: Pick<Assignee, 'name' | 'email'> | undefined) =>
  a?.name || a?.email || 'Someone';

export const initials = (a: Pick<Assignee, 'name' | 'email'> | undefined) =>
  (a?.name || a?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** "2h", "1h 30m", "45m" */
export function formatMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r}m`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

/** The one group a person is listed under in the picker. */
export const primaryGroup = (a: Assignee): AccountGroup => a.groups[0] ?? 'tradesmen';

/** Small line icons, drawn in the text colour. */
export function Icon({
  name,
  className = 'h-4 w-4',
}: {
  name: 'clock' | 'note' | 'close' | 'plus' | 'search';
  className?: string;
}) {
  const paths: Record<string, string> = {
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    note: 'M7 4h7l5 5v11H7zM14 4v5h5M10 13h6M10 16.5h4',
    close: 'M6 6l12 12M18 6 6 18',
    plus: 'M12 5v14M5 12h14',
    search: 'm20 20-4.5-4.5M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/** Initials in a row of overlapping chips. */
export function Avatars({ people, size = 'h-7 w-7' }: { people: Assignee[]; size?: string }) {
  if (people.length === 0) return <span className="text-ash text-[0.8rem] italic">No one yet</span>;
  const shown = people.slice(0, 4);
  return (
    <ul
      className="flex -space-x-1.5"
      aria-label={`Assigned to ${people.map(personName).join(', ')}`}
    >
      {shown.map((p) => (
        <li
          key={p.id}
          title={personName(p)}
          className={`${size} bg-stone border-paper text-charcoal ring-mortar flex items-center justify-center rounded-full border-2 text-[0.7rem] font-semibold ring-1`}
        >
          <span aria-hidden="true">{initials(p)}</span>
        </li>
      ))}
      {people.length > shown.length && (
        <li
          className={`${size} bg-charcoal border-paper text-paper flex items-center justify-center rounded-full border-2 text-[0.7rem] font-semibold`}
          aria-hidden="true"
        >
          +{people.length - shown.length}
        </li>
      )}
    </ul>
  );
}

/**
 * A searchable single select (ARIA combobox): type to narrow, arrows to move,
 * Enter to pick, Escape to close. An empty pick means everyone.
 */
export function PersonCombo({
  id,
  label,
  people,
  value,
  onChange,
  emptyLabel = 'Everyone',
}: {
  id: string;
  label: string;
  people: { id: string; name: string; detail?: string }[];
  value: string;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  const picked = people.find((p) => p.id === value);
  const [query, setQuery] = useState(picked?.name ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Clearing the filter elsewhere (a chip, Back) empties the box too.
  useEffect(() => {
    setQuery(picked?.name ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, picked?.name]);
  const q = query.trim().toLowerCase();
  const options = [
    { id: '', name: emptyLabel, detail: '' },
    ...people.filter((p) => !q || picked?.name === query || p.name.toLowerCase().includes(q)),
  ];
  function pick(o: { id: string; name: string }) {
    onChange(o.id);
    setQuery(o.id ? o.name : '');
    setOpen(false);
  }
  return (
    <div className="relative flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[0.8rem] font-semibold tracking-[0.1em] uppercase">
        {label}
      </label>
      <div className="relative">
        <span className="text-ash pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2">
          <Icon name="search" />
        </span>
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder={emptyLabel}
          value={query}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (!e.target.value) onChange('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && open) {
              e.preventDefault();
              if (options[active]) pick(options[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="border-mortar bg-paper focus:border-brass w-full min-w-0 rounded-sm border py-1.5 pr-2 pl-8 font-sans text-[0.95rem]"
        />
      </div>
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="border-mortar bg-paper absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-sm border py-1 shadow-lg"
        >
          {options.map((o, i) => (
            <li
              key={o.id || 'all'}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 text-[0.95rem] ${i === active ? 'bg-stone' : ''} ${o.id === value ? 'font-semibold' : ''}`}
            >
              <span>{o.name}</span>
              {o.detail && <span className="text-ash text-[0.8rem]">{o.detail}</span>}
            </li>
          ))}
          {options.length === 1 && q && (
            <li className="text-ash px-3 py-1.5 text-[0.9rem]">No one matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}
