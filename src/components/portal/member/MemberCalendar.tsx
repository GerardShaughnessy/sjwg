import { useEffect, useState } from 'react';
import type { GuildEvent } from '@/lib/types';
import { formatEventDate, formatEventTime, monthKey, splitEvents } from '@/lib/events';
import { events as eventsApi, reminders, type ReminderPrefs } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { btnPrimary, ErrorStrip, inputCls, Loading, msg, Status } from '../ui';

/** Upcoming events, live from the database, plus reminder preferences. */
export default function MemberCalendar({ initial }: { initial: GuildEvent[] }) {
  const { data, error } = useResource(() => eventsApi.list(), []);
  const all = (data ?? initial).filter(
    (e) => !('published' in e) || (e as { published?: boolean }).published !== false,
  );
  const { upcoming } = splitEvents(all);
  const groups = new Map<string, GuildEvent[]>();
  for (const e of upcoming)
    groups.set(monthKey(e.start), [...(groups.get(monthKey(e.start)) ?? []), e]);

  const [prefs, setPrefs] = useState<ReminderPrefs>({ email: false, sms: false, phone: '' });
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    reminders
      .get()
      .then((p) => setPrefs(p))
      .catch(() => setStatus('Could not load your reminder settings.'))
      .finally(() => setLoaded(true));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFieldError('');
    setPending(true);
    setStatus('Saving.');
    try {
      const saved = await reminders.save(prefs);
      setPrefs(saved);
      setStatus(
        `Saved. ${saved.email ? 'You will get an email the day before each event.' : 'Email reminders are off.'}${saved.sms ? ' Text reminders start once the Guild turns on texting.' : ''}`,
      );
    } catch (err) {
      setStatus('');
      setFieldError(msg(err, 'Could not save.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
      <div>
        <h2 className="text-h2">Calendar</h2>
        {error && (
          <div className="mt-4">
            <ErrorStrip>{error}</ErrorStrip>
          </div>
        )}
        {upcoming.length === 0 && <p className="text-ash mt-4 font-sans">Nothing scheduled yet.</p>}
        {[...groups.entries()].map(([month, list]) => (
          <section key={month} aria-labelledby={`m-${month.replace(/\s/g, '')}`} className="mt-8">
            <h3
              id={`m-${month.replace(/\s/g, '')}`}
              className="text-brass font-sans text-[0.95rem] font-semibold"
            >
              {month}
            </h3>
            <ul className="border-mortar mt-2 border-t">
              {list.map((ev) => (
                <li
                  key={ev.id}
                  className="border-mortar grid gap-1 border-b py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"
                >
                  <p className="text-ash font-sans text-[0.95rem]">
                    {formatEventDate(ev.start)}
                    <br />
                    {formatEventTime(ev.start)}
                  </p>
                  <div>
                    <p className="font-serif text-[1.2rem]">
                      <a href={`/events/${ev.slug}`} className="no-underline hover:underline">
                        {ev.title}
                      </a>
                    </p>
                    <p className="text-ash font-sans text-[0.95rem]">
                      {ev.location}. {ev.membersOnly ? 'Members and families.' : 'Open to all.'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <form onSubmit={save} className="border-brass bg-paper self-start border-t-4 p-6">
        <h3 className="text-h3">Reminders</h3>
        <p className="text-ash mt-2 font-sans text-[0.95rem]">
          Get a note the day before each event.
        </p>
        {!loaded ? (
          <div className="mt-4">
            <Loading what="your settings" />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3 font-sans">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="accent-brick h-5 w-5"
                checked={prefs.email}
                onChange={(e) => setPrefs({ ...prefs, email: e.target.checked })}
              />
              Email me
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="accent-brick h-5 w-5"
                checked={prefs.sms}
                onChange={(e) => setPrefs({ ...prefs, sms: e.target.checked })}
              />
              Text me <span className="text-ash text-[0.85rem]">(coming soon)</span>
            </label>
            {prefs.sms && (
              <label className="flex flex-col gap-1 text-[0.95rem]">
                <span className="font-semibold">Mobile number</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={prefs.phone}
                  onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })}
                  className={inputCls}
                  aria-invalid={fieldError ? true : undefined}
                />
              </label>
            )}
            {fieldError && (
              <p role="alert" className="text-brick text-[0.95rem] font-semibold">
                {fieldError}
              </p>
            )}
            <button type="submit" disabled={pending} className={`${btnPrimary} mt-2`}>
              Save reminder settings
            </button>
            <Status>{status}</Status>
          </div>
        )}
      </form>
    </div>
  );
}
