import { useState } from 'react';
import type { EventKind, GuildEvent } from '@/lib/types';
import { events as api, type EventInput } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatEventDate, formatEventTime } from '@/lib/events';
import {
  btnMuted,
  btnPrimary,
  btnQuiet,
  ErrorStrip,
  inputCls,
  Labeled,
  Loading,
  msg,
  rebuildNote,
  Status,
} from '../ui';

const KINDS: { value: EventKind; label: string }[] = [
  { value: 'mass', label: 'Mass or adoration' },
  { value: 'meeting', label: 'Meeting or formation' },
  { value: 'retreat', label: 'Retreat' },
  { value: 'procession', label: 'Procession' },
  { value: 'workday', label: 'Work day' },
  { value: 'party', label: 'Party or meal' },
  { value: 'other', label: 'Other' },
];

const EMPTY: EventInput = {
  title: '',
  kind: 'other',
  start: '',
  end: '',
  location: 'Saint Mary of Victories, St. Louis',
  summary: '',
  body: '',
  membersOnly: false,
  published: true,
  tk: undefined,
};

/** ISO with offset -> value for datetime-local, in Chicago time. */
function toLocal(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`;
}

/** datetime-local (Chicago wall clock) -> ISO with the right offset for that date. */
function fromLocal(local: string): string {
  if (!local) return '';
  const [date, time] = local.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  // Find the UTC instant whose Chicago wall clock matches, trying both offsets.
  for (const offset of [-5, -6]) {
    const guess = new Date(Date.UTC(y, m - 1, d, hh - offset, mm));
    if (toLocal(guess.toISOString()) === local) return guess.toISOString();
  }
  return new Date(Date.UTC(y, m - 1, d, hh + 6, mm)).toISOString();
}

export default function EventsEditor() {
  const { data, loading, error } = useResource(() => api.list(), []);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<EventInput>(EMPTY);
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function edit(e: GuildEvent & { published?: boolean }) {
    setId(e.id);
    setForm({
      title: e.title,
      kind: e.kind,
      start: e.start,
      end: e.end ?? '',
      location: e.location,
      summary: e.summary,
      body: e.body,
      membersOnly: e.membersOnly,
      published: e.published !== false,
      tk: e.tk,
    });
    setStatus(`Editing "${e.title}".`);
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function reset() {
    setId(null);
    setForm(EMPTY);
    setStatus('');
    setFields({});
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFields({});
    setPending(true);
    try {
      const payload = { ...form, end: form.end || '' };
      const { rebuild } = id ? await api.update(id, payload) : await api.create(payload);
      setStatus(`${id ? 'Saved' : 'Added'} "${form.title}". ${rebuildNote(rebuild)}`);
      if (!id) reset();
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setFormError(msg(err, 'Could not save the event.'));
    } finally {
      setPending(false);
    }
  }
  async function remove(e: GuildEvent) {
    try {
      const { rebuild } = await api.remove(e.id);
      if (id === e.id) reset();
      setStatus(`Deleted "${e.title}". ${rebuildNote(rebuild)}`);
    } catch (err) {
      setFormError(msg(err, 'Could not delete that.'));
    }
  }

  const list = (data ?? []).slice().sort((a, b) => +new Date(b.start) - +new Date(a.start));

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <form onSubmit={save} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">{id ? 'Edit event' : 'New event'}</h2>
        <p className="text-ash text-[0.95rem]">
          Times are Central time. Published events appear on the events page, the home page, and the
          member calendar.
        </p>
        <Labeled label="Title" error={fields.title}>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
        </Labeled>
        <Labeled label="Kind">
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as EventKind })}
            className={inputCls}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Labeled>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Starts" error={fields.start}>
            <input
              type="datetime-local"
              value={toLocal(form.start)}
              onChange={(e) => setForm({ ...form, start: fromLocal(e.target.value) })}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Ends" hint="Optional." error={fields.end}>
            <input
              type="datetime-local"
              value={toLocal(form.end || undefined)}
              onChange={(e) => setForm({ ...form, end: fromLocal(e.target.value) })}
              className={inputCls}
            />
          </Labeled>
        </div>
        <Labeled label="Location" error={fields.location}>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className={inputCls}
          />
        </Labeled>
        <Labeled label="One-line summary" error={fields.summary}>
          <input
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            maxLength={300}
            className={inputCls}
          />
        </Labeled>
        <Labeled
          label="Details"
          hint="Plain text. Blank lines separate paragraphs."
          error={fields.body}
        >
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={6}
            className={inputCls}
          />
        </Labeled>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-brick h-5 w-5"
            checked={form.membersOnly}
            onChange={(e) => setForm({ ...form, membersOnly: e.target.checked })}
          />
          Members and families only
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-brick h-5 w-5"
            checked={form.published}
            onChange={(e) => setForm({ ...form, published: e.target.checked })}
          />
          Published (untick to keep it as a draft)
        </label>
        {formError && <ErrorStrip>{formError}</ErrorStrip>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? 'Saving' : id ? 'Save changes' : 'Add event'}
          </button>
          {id && (
            <button type="button" onClick={reset} className={btnQuiet}>
              New event instead
            </button>
          )}
          <Status>{status}</Status>
        </div>
      </form>
      <div>
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">All events</h3>
        {error && (
          <div className="mt-2">
            <ErrorStrip>{error}</ErrorStrip>
          </div>
        )}
        {loading && !data && (
          <div className="mt-2">
            <Loading what="events" />
          </div>
        )}
        {data && list.length === 0 && <p className="text-ash mt-2 font-sans">No events yet.</p>}
        {list.length > 0 && (
          <ul className="border-mortar mt-2 border-t font-sans">
            {list.map((e) => (
              <li
                key={e.id}
                className="border-mortar flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <div>
                  <p className="font-serif text-[1.15rem]">
                    {e.title}
                    {e.published === false && (
                      <span className="bg-mortar/50 ml-2 px-1.5 py-0.5 font-sans text-[0.8rem]">
                        draft
                      </span>
                    )}
                  </p>
                  <p className="text-ash text-[0.85rem]">
                    {formatEventDate(e.start)}, {formatEventTime(e.start)}. {e.location}
                  </p>
                </div>
                <div className="flex gap-4 text-[0.95rem]">
                  <button type="button" onClick={() => edit(e)} className={btnQuiet}>
                    Edit
                  </button>
                  <button type="button" onClick={() => remove(e)} className={btnMuted}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
