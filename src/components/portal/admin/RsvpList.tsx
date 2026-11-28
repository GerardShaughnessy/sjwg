import { useEffect, useState } from 'react';
import { call } from '@/lib/api';
import { Badge, Card } from '../layout';
import { ErrorStrip, Loading } from '../ui';

interface Rsvp {
  name: string;
  email: string;
  phone: string;
  attending: 'yes' | 'no';
  adults: number;
  children: number;
  at: string;
}
interface RsvpList {
  capacity: number;
  coming: number;
  yes: number;
  no: number;
  adults: number;
  children: number;
  rsvps: Rsvp[];
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  });

const phoneText = (p: string) => {
  const d = p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

/** A spreadsheet cell: quoted, and a leading = + - @ neutralised so a spreadsheet never runs it. */
const cell = (v: string | number) => {
  const s = String(v);
  return `"${(/^\s*[=+\-@]|^[\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

function downloadCsv(list: RsvpList) {
  const head = ['Name', 'Coming', 'Adults', 'Children', 'Email', 'Phone', 'RSVP date'];
  const lines = list.rsvps.map((r) =>
    [
      r.name,
      r.attending === 'yes' ? 'Yes' : 'No',
      r.adults,
      r.children,
      r.email,
      phoneText(r.phone),
      day(r.at),
    ]
      .map(cell)
      .join(','),
  );
  const blob = new Blob(['\uFEFF' + [head.map(cell).join(','), ...lines].join('\r\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'christmas-party-rsvps.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The Christmas party RSVP list for officers, with totals and a spreadsheet download. */
export default function RsvpListPanel() {
  const [list, setList] = useState<RsvpList | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    call<RsvpList>('/api/rsvp/list')
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the RSVPs.'));
  };
  useEffect(load, []);

  if (error)
    return (
      <div className="flex flex-col items-start gap-3">
        <ErrorStrip>{error}</ErrorStrip>
        <button type="button" onClick={load} className="font-sans font-semibold underline">
          Try again
        </button>
      </div>
    );
  if (!list) return <Loading what="RSVPs" />;

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p
            className="font-serif text-[2.2rem] leading-none tabular-nums"
            aria-label={`${list.coming} of ${list.capacity} people coming`}
          >
            {list.coming}
            <span className="text-ash text-[1.1rem]"> of {list.capacity}</span>
          </p>
          <p className="mt-2 font-semibold">People coming</p>
          <p className="text-ash text-[0.9rem]">
            {list.adults} adults, {list.children} children
          </p>
        </Card>
        <Card>
          <p
            className="font-serif text-[2.2rem] leading-none tabular-nums"
            aria-label={`${list.yes} yes RSVPs`}
          >
            {list.yes}
          </p>
          <p className="mt-2 font-semibold">Yes RSVPs</p>
          <p className="text-ash text-[0.9rem]">Households or groups</p>
        </Card>
        <Card>
          <p
            className="font-serif text-[2.2rem] leading-none tabular-nums"
            aria-label={`${list.no} answered no`}
          >
            {list.no}
          </p>
          <p className="mt-2 font-semibold">Can't make it</p>
          <p className="text-ash text-[0.9rem]">Answered no</p>
        </Card>
      </div>

      <Card
        title="Everyone who answered"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={load}
              className="border-charcoal hover:bg-charcoal hover:text-stone border-2 px-3.5 py-1.5 font-semibold"
            >
              Refresh
            </button>
            {list.rsvps.length ? (
              <button
                type="button"
                onClick={() => downloadCsv(list)}
                className="border-charcoal hover:bg-charcoal hover:text-stone border-2 px-3.5 py-1.5 font-semibold"
              >
                Download spreadsheet
              </button>
            ) : null}
          </div>
        }
      >
        {list.rsvps.length === 0 ? (
          <p className="text-ash">
            No RSVPs yet. They appear here as people answer at sjwg.org/christmas.
          </p>
        ) : (
          <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Christmas RSVPs">
            <table className="w-full min-w-[640px] text-left text-[0.95rem]">
              <caption className="sr-only">Christmas party RSVPs, latest answer per email</caption>
              <thead>
                <tr className="text-ash text-[0.8rem] tracking-wide uppercase">
                  <th scope="col" className="pb-2 font-semibold">
                    Name
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Coming
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Email
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    Phone
                  </th>
                  <th scope="col" className="pb-2 font-semibold">
                    RSVP'd
                  </th>
                </tr>
              </thead>
              <tbody className="divide-mortar divide-y">
                {list.rsvps.map((r) => (
                  <tr key={r.email}>
                    <td className="py-2.5 pr-3 font-semibold">{r.name}</td>
                    <td className="py-2.5 pr-3">
                      {r.attending === 'yes' ? (
                        <Badge tone="done">
                          {r.adults} {r.adults === 1 ? 'adult' : 'adults'}
                          {r.children
                            ? `, ${r.children} ${r.children === 1 ? 'child' : 'children'}`
                            : ''}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">No</Badge>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 break-all">{r.email}</td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      {r.phone ? phoneText(r.phone) : 'Not given'}
                    </td>
                    <td className="text-ash py-2.5 whitespace-nowrap">{day(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-ash mt-4 text-[0.85rem]">
          If someone answers twice with the same email, only their latest answer counts.
        </p>
      </Card>
    </div>
  );
}
