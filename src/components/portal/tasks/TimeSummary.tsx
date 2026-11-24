import { useEffect, useState } from 'react';
import { tasks as api } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import type { Session } from '@/lib/types';
import { ErrorStrip, Loading } from '../ui';
import { Card } from '../layout';
import { formatMinutes, PersonCombo, shortDate } from './shared';

const monthName = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const hours = (m: number) => (m / 60).toLocaleString('en-US', { maximumFractionDigits: 1 });

/**
 * Hours per person this month and all time, and the latest entries.
 * Officers see everyone and can narrow to one person (kept in the address bar
 * as ?person=); everyone else sees their own time.
 */
export default function TimeSummary({ session }: { session: Session }) {
  const manager = session.role === 'admin';
  const [person, setPerson] = useState('');
  useEffect(() => {
    setPerson(new URLSearchParams(window.location.search).get('person') ?? '');
  }, []);
  function pick(id: string) {
    setPerson(id);
    const p = new URLSearchParams(window.location.search);
    if (id) p.set('person', id);
    else p.delete('person');
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${p}`);
  }
  const all = useResource(() => (manager ? api.timeSummary() : Promise.resolve(null)), [manager]);
  const { data, loading, error } = useResource(
    () => api.timeSummary(manager ? person || undefined : undefined),
    [person, manager],
  );
  if (loading && !data) return <Loading what="the time summary" />;
  if (error && !data) return <ErrorStrip>{error}</ErrorStrip>;
  if (!data) return null;
  const options = (all.data?.people ?? data.people)
    .filter((p) => p.userId)
    .map((p) => ({ id: p.userId!, name: p.name }));
  const month = data.people.reduce((n, p) => n + p.monthMinutes, 0);
  const total = data.people.reduce((n, p) => n + p.totalMinutes, 0);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_minmax(14rem,18rem)] sm:items-end">
        <div className="border-mortar bg-paper rounded-md border p-4">
          <p className="font-serif text-[2.2rem] leading-none">{hours(month)}</p>
          <p className="mt-1 font-semibold">Hours in {monthName(data.monthStart)}</p>
        </div>
        <div className="border-mortar bg-paper rounded-md border p-4">
          <p className="font-serif text-[2.2rem] leading-none">{hours(total)}</p>
          <p className="mt-1 font-semibold">Hours all time</p>
        </div>
        {manager && (
          <PersonCombo
            id="time-person"
            label="Person"
            people={options}
            value={person}
            onChange={pick}
          />
        )}
      </div>

      <Card title={manager ? 'Hours per person' : 'Your hours'} bodyClass="p-0">
        {data.people.length === 0 ? (
          <p className="text-ash p-5">No time logged yet. Open a task and use Log time.</p>
        ) : (
          <table className="w-full text-left text-[0.95rem]">
            <caption className="sr-only">Hours per person, this month and all time</caption>
            <thead>
              <tr className="border-mortar text-ash border-b text-[0.75rem] tracking-[0.12em] uppercase">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Person
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  This month
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  All time
                </th>
              </tr>
            </thead>
            <tbody className="divide-mortar divide-y">
              {data.people.map((p) => (
                <tr key={p.userId ?? 'former'}>
                  <th scope="row" className="px-5 py-2.5 font-semibold">
                    {p.name}
                  </th>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {formatMinutes(p.monthMinutes)}
                  </td>
                  <td className="px-5 py-2.5 text-right tabular-nums">
                    {formatMinutes(p.totalMinutes)}
                  </td>
                </tr>
              ))}
            </tbody>
            {data.people.length > 1 && (
              <tfoot>
                <tr className="border-charcoal border-t-2">
                  <th scope="row" className="px-5 py-2.5">
                    Total
                  </th>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                    {formatMinutes(month)}
                  </td>
                  <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                    {formatMinutes(total)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </Card>

      {data.recent.length > 0 && (
        <Card title="Latest entries">
          <ul className="divide-mortar flex flex-col divide-y text-[0.95rem]">
            {data.recent.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{e.name}</span>
                  <span className="text-ash"> on </span>
                  <a
                    href={`?tab=tasks&sub=board&task=${e.taskId}`}
                    className="decoration-mortar hover:decoration-brass underline underline-offset-4"
                  >
                    {e.taskTitle}
                  </a>
                  {e.note && <span className="text-ash block text-[0.9rem]">{e.note}</span>}
                </span>
                <span className="text-ash shrink-0 tabular-nums">
                  {shortDate(e.workedOn)} ·{' '}
                  <span className="text-charcoal font-semibold">{formatMinutes(e.minutes)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
