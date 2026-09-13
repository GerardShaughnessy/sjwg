import { useState } from 'react';
import type { GuildEvent } from '@/lib/types';
import { formatEventDate, formatEventTime, monthKey, splitEvents } from '@/lib/events';
import { reminders } from '@/lib/store';
import { useStoreVersion } from '@/lib/hooks';
import { isPhone } from '@/lib/validate';

/** Upcoming events grouped by month, plus email/text reminder preferences. */
export default function MemberCalendar({ events }: { events: GuildEvent[] }) {
  useStoreVersion();
  const { upcoming } = splitEvents(events);
  const groups = new Map<string, GuildEvent[]>();
  for (const e of upcoming)
    groups.set(monthKey(e.start), [...(groups.get(monthKey(e.start)) ?? []), e]);

  const saved = reminders.get();
  const [prefs, setPrefs] = useState(saved);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (prefs.sms && !isPhone(prefs.phone)) {
      setError('Text reminders need a ten-digit mobile number.');
      return;
    }
    setPending(true);
    setStatus('Saving.');
    try {
      await reminders.save(prefs);
      setStatus(
        `Saved. ${prefs.email || prefs.sms ? 'You will get reminders before each event.' : 'Reminders are off.'}`,
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_20rem] lg:gap-16">
      <div>
        <h2 className="text-h2">Calendar</h2>
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
          Get a note a few days before each event.
        </p>
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
            Text me
          </label>
          {prefs.sms && (
            <label className="flex flex-col gap-1 text-[0.95rem]">
              <span className="font-semibold">Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                value={prefs.phone}
                onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })}
                className="border-charcoal bg-paper border-2 px-3 py-2"
                aria-invalid={error ? true : undefined}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-brick text-[0.95rem] font-semibold">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="bg-brick text-paper hover:bg-kiln mt-2 px-4 py-2.5 font-semibold disabled:opacity-60"
          >
            Save reminder settings
          </button>
          <p role="status" aria-live="polite" className="text-ash text-[0.9rem]">
            {status}
          </p>
        </div>
      </form>
    </div>
  );
}
