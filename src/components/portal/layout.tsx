import { useState, type ReactNode } from 'react';
import type { Tone } from '@/lib/api-portal';
import { formatEventTime, TIME_ZONE } from '@/lib/events';

/** "Thu, Dec 3" in St. Louis time. */
const eventDay = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));

/**
 * The portal's shared look, from the approved mockup: rounded cards on
 * paper, tone badges (done green, waiting mustard, attention red, neutral),
 * page heads with a serif title and a hairline rule.
 */
export type { Tone };

export const TONE: Record<Tone, string> = {
  done: 'bg-[#e3ead9] text-[#2f4a2c] border-[#9fb592]',
  waiting: 'bg-[#f3e6c4] text-[#6b4f12] border-[#d9ae52]',
  attention: 'bg-[#f2dcd5] text-[#7c2d1f] border-[#c98a7a]',
  neutral: 'bg-paper text-ash border-mortar',
};
export const DOT: Record<Tone, string> = {
  done: 'bg-[#4f7a48]',
  waiting: 'bg-brass',
  attention: 'bg-[#a8432f]',
  neutral: 'bg-mortar',
};
/** Words a screen reader hears for a coloured dot. */
export const TONE_WORD: Record<Tone, string> = {
  done: 'Done',
  waiting: 'Waiting',
  attention: 'Needs attention',
  neutral: 'Not started',
};

export const pBtn =
  'bg-brick text-paper hover:bg-kiln inline-flex items-center justify-center rounded-sm px-4 py-2 font-sans text-[0.95rem] font-semibold no-underline disabled:opacity-60';
export const pBtnQuiet =
  'border-charcoal hover:bg-charcoal hover:text-stone inline-flex items-center justify-center rounded-sm border-2 px-3.5 py-1.5 font-sans text-[0.9rem] font-semibold no-underline disabled:opacity-40';
export const pLink =
  'text-brass-ink decoration-brass font-sans font-semibold underline underline-offset-4';

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-[0.8rem] font-semibold whitespace-nowrap ${TONE[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} aria-hidden="true" />
      {children}
    </span>
  );
}

export function Dot({ tone }: { tone: Tone }) {
  return (
    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${DOT[tone]}`}>
      <span className="sr-only">{TONE_WORD[tone]}</span>
    </span>
  );
}

export function Card({
  title,
  action,
  children,
  className = '',
  bodyClass = 'p-5',
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`border-mortar bg-paper min-w-0 rounded-md border ${className}`}>
      {title && (
        <div className="border-mortar flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <h2 className="font-sans text-[0.95rem] font-semibold tracking-wide uppercase">
            {title}
          </h2>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHead({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="border-mortar mb-6 border-b pb-4">
      <h1 tabIndex={-1} className="font-serif text-[2rem] leading-tight outline-none">
        {title}
      </h1>
      <p className="text-ash mt-1 font-sans">{lede}</p>
    </div>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div
      className="bg-mortar/50 mt-3 h-2 overflow-hidden rounded-full"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      aria-label={`${done} of ${total} done`}
    >
      <div className="bg-brass h-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export interface ChecklistRow {
  key: string;
  label: string;
  tone: Tone;
  detail: string;
}

export function Checklist({ items }: { items: ChecklistRow[] }) {
  return (
    <ul className="divide-mortar flex flex-col divide-y font-sans">
      {items.map((i) => (
        <li
          key={i.key}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0"
        >
          <span>{i.label}</span>
          <Badge tone={i.tone}>{i.detail}</Badge>
        </li>
      ))}
    </ul>
  );
}

export interface EventRow {
  id: string;
  title: string;
  start: string;
  end: string | null;
  location: string;
}

export function EventList({ events }: { events: EventRow[] }) {
  if (events.length === 0)
    return <p className="text-ash font-sans">Nothing on the calendar yet.</p>;
  return (
    <ul className="divide-mortar flex flex-col divide-y font-sans">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
          <div className="border-brass w-36 shrink-0 border-l-4 pl-3">
            <p className="font-semibold">{eventDay(e.start)}</p>
            <p className="text-ash text-[0.85rem]">{formatEventTime(e.start)}</p>
          </div>
          <div className="min-w-0">
            <p className="font-semibold">{e.title}</p>
            {e.location && <p className="text-ash text-[0.9rem]">{e.location}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface SubTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Secondary tabs inside a page (Communications, Giving, Tradesmen). ARIA tabs
 * with arrow keys; the panel stays mounted only while shown.
 */
export function SubTabs({
  tabs,
  label,
  initial,
}: {
  tabs: SubTab[];
  label: string;
  initial?: string;
}) {
  const [active, setActive] = useState(
    tabs.some((t) => t.id === initial) ? initial! : tabs[0].id,
  );
  const i = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );
  function onKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + tabs.length) % tabs.length;
    setActive(tabs[n].id);
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[n]?.focus();
  }
  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKey}
        className="border-mortar mb-6 flex flex-wrap gap-1 border-b-2 font-sans"
      >
        {tabs.map((t, n) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`sub-${t.id}`}
            aria-selected={n === i}
            aria-controls={`subpanel-${t.id}`}
            tabIndex={n === i ? 0 : -1}
            onClick={() => setActive(t.id)}
            className={`-mb-[2px] border-b-4 px-4 py-2.5 font-semibold ${n === i ? 'border-brick' : 'text-ash hover:text-charcoal border-transparent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`subpanel-${tabs[i].id}`} aria-labelledby={`sub-${tabs[i].id}`}>
        {tabs[i].content}
      </div>
    </div>
  );
}
