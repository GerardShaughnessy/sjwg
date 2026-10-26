import { useEffect, useState } from 'react';
import { hours as api, type HoursEntry } from '@/lib/api';
import { btnMuted, btnPrimary, btnQuiet, ErrorStrip, inputCls, Loading, msg, Status } from '../ui';

const GOAL = 16;
const SUGGESTIONS = [
  'Parish work day',
  'Home repair for a family in need',
  'Repairs at the church or school',
  'Storm cleanup',
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmt = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(2).replace(/0$/, ''));
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

/**
 * Logged charity hours toward the yearly requirement. Private to the member and
 * the officers. With no memberId it is the caller's own entry (My entry); the
 * Members tab passes one so an officer can log or fix hours for anyone.
 */
export default function ServiceHours({
  memberId,
  name,
  onTotal,
}: {
  memberId?: string;
  name?: string;
  onTotal?: (hours: number) => void;
}) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [list, setList] = useState<HoursEntry[] | null>(null);
  const [form, setForm] = useState({ workDate: today(), hours: '', description: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    setList(null);
    api
      .list(year, memberId)
      .then(setList)
      .catch((err) => {
        setList([]);
        setError(msg(err, 'Could not load the hours.'));
      });
  }, [year, memberId]);

  const total = (list ?? []).reduce((n, e) => n + e.hours, 0);
  useEffect(() => {
    if (list && year === thisYear) onTotal?.(total);
  }, [list]);

  const who = name ? `${name.split(' ')[0]}'s` : 'Your';

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError('');
    setFields({});
    try {
      const entry = await api.add({
        memberId,
        workDate: form.workDate,
        hours: Number(form.hours),
        description: form.description,
      });
      if (entry.workDate.startsWith(String(year)))
        setList((l) => [entry, ...(l ?? [])].sort((a, b) => b.workDate.localeCompare(a.workDate)));
      setStatus(`Logged ${fmt(entry.hours)} hours on ${longDate(entry.workDate)}.`);
      setForm({ workDate: form.workDate, hours: '', description: '' });
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setError(msg(err, 'Could not log those hours.'));
    } finally {
      setPending(false);
    }
  }

  async function remove(entry: HoursEntry) {
    setPending(true);
    try {
      await api.remove(entry.id);
      setList((l) => (l ?? []).filter((x) => x.id !== entry.id));
      setStatus(`Removed ${fmt(entry.hours)} hours on ${longDate(entry.workDate)}.`);
    } catch (err) {
      setError(msg(err, 'Could not remove that entry.'));
    } finally {
      setPending(false);
      setConfirm(null);
    }
  }

  const pct = Math.min(100, (total / GOAL) * 100);
  return (
    <section aria-labelledby={`hours-${memberId ?? 'me'}`} className="@container font-sans">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id={`hours-${memberId ?? 'me'}`}
          className={`${name ? 'text-h3' : 'text-h2'} font-serif`}
        >
          {who} service hours
        </h2>
        <label className="flex items-center gap-2 text-[0.95rem]">
          <span className="text-ash">Year</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={`${inputCls} py-1`}
          >
            {[thisYear, thisYear - 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-ash mt-2 max-w-[60ch] text-[0.95rem]">
        Members give at least {GOAL} hours of designated charity work a year (6 for Guild Builders):
        parish work days and repairs for people in need. Only you and the officers see these.
      </p>

      <div className="mt-5">
        <p className="text-[1.1rem]">
          <span className="font-serif text-[1.6rem]">{fmt(total)}</span>
          <span className="text-ash">
            {' '}
            of {GOAL} hours in {year}
          </span>
          {total >= GOAL && (
            <span className="text-brick ml-2 font-semibold">Done for the year</span>
          )}
        </p>
        <div
          className="border-charcoal bg-paper mt-2 h-3 max-w-md border"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={GOAL}
          aria-valuenow={total}
          aria-label={`${fmt(total)} of ${GOAL} hours`}
        >
          <div className="bg-brass h-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <form onSubmit={add} className="mt-6 grid max-w-2xl gap-4 @lg:grid-cols-[auto_7rem_1fr]">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Date</span>
          <input
            type="date"
            value={form.workDate}
            max={today()}
            onChange={(e) => setForm({ ...form, workDate: e.target.value })}
            className={inputCls}
            required
          />
          {fields.workDate && <span className="text-brick text-[0.9rem]">{fields.workDate}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Hours</span>
          <input
            type="number"
            min={0.25}
            max={24}
            step={0.25}
            inputMode="decimal"
            value={form.hours}
            onChange={(e) => setForm({ ...form, hours: e.target.value })}
            className={inputCls}
            required
          />
          {fields.hours && <span className="text-brick text-[0.9rem]">{fields.hours}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">What was the work?</span>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            list="hours-suggestions"
            maxLength={300}
            placeholder="Parish work day"
            className={inputCls}
            required
          />
          {fields.description && (
            <span className="text-brick text-[0.9rem]">{fields.description}</span>
          )}
        </label>
        <datalist id="hours-suggestions">
          {SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <div className="flex flex-wrap items-center gap-4 @lg:col-span-3">
          <button type="submit" disabled={pending} className={btnPrimary}>
            Log hours
          </button>
          <Status>{status}</Status>
        </div>
      </form>
      {error && (
        <div className="mt-4 max-w-2xl">
          <ErrorStrip>{error}</ErrorStrip>
        </div>
      )}

      <div className="mt-6 max-w-2xl">
        {list === null ? (
          <Loading what="hours" />
        ) : list.length === 0 ? (
          <p className="text-ash">Nothing logged for {year} yet.</p>
        ) : (
          <ul className="border-mortar border-t">
            {list.map((e) => (
              <li
                key={e.id}
                className="border-mortar grid grid-cols-[6.5rem_3.5rem_1fr_auto] items-baseline gap-3 border-b py-3 text-[0.95rem]"
              >
                <span className="text-ash text-[0.9rem]">{longDate(e.workDate)}</span>
                <span className="font-semibold">{fmt(e.hours)} h</span>
                <span className="min-w-0">
                  {e.description}
                  {e.loggedByName && name && (
                    <span className="text-ash block text-[0.8rem]">Logged by {e.loggedByName}</span>
                  )}
                </span>
                {confirm === e.id ? (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => remove(e)}
                      disabled={pending}
                      className={btnMuted}
                    >
                      Yes, remove
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className={btnQuiet}>
                      Keep
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm(e.id)} className={btnMuted}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
