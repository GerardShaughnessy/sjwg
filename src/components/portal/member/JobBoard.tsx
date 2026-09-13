import { useState } from 'react';
import type { HelpRequest, RequestStatus, Session } from '@/lib/types';
import { requests } from '@/lib/store';
import { useStoreVersion } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';

const STATUS: Record<RequestStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  referred: 'Referred',
  closed: 'Closed',
};
const URGENCY: Record<HelpRequest['urgency'], string> = {
  'can-wait': 'Can wait',
  'getting-worse': 'Getting worse',
  'no-heat-or-water': 'No heat, water, or not safe',
};

/** Open help requests, including ones sent from this browser via /request. */
export default function JobBoard({
  session,
  memberNames,
}: {
  session: Session;
  memberNames: Record<string, string>;
}) {
  useStoreVersion();
  const [filter, setFilter] = useState<RequestStatus | 'all'>('open');
  const [busy, setBusy] = useState<string | null>(null);
  const [referNote, setReferNote] = useState<Record<string, string>>({});
  const list = requests.list().filter((r) => filter === 'all' || r.status === filter);
  const me = session.memberId ?? 'm-01';

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2">Job board</h2>
          <p className="text-ash mt-2 max-w-[56ch] font-sans text-[0.95rem]">
            Requests from the public form. Claim one to take it, refer it to another member, or
            close it when done. Requests sent from this browser show up here too.
          </p>
        </div>
        <label className="font-sans text-[0.95rem]">
          <span className="mr-2 font-semibold">Show</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as RequestStatus | 'all')}
            className="border-charcoal bg-paper border-2 px-3 py-2"
          >
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="referred">Referred</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <p className="border-brass bg-paper mt-8 border-t-4 p-6">
          Nothing {filter === 'all' ? 'yet' : filter} right now.
        </p>
      ) : (
        <ul className="border-mortar mt-6 border-t">
          {list.map((r) => (
            <li
              key={r.id}
              className="border-mortar grid gap-4 border-b py-6 lg:grid-cols-[1fr_18rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="text-h3">{r.trade}</h3>
                  <span
                    className={`px-2 py-0.5 font-sans text-[0.85rem] font-semibold ${r.urgency === 'no-heat-or-water' ? 'bg-brick text-paper' : 'bg-mortar/50'}`}
                  >
                    {URGENCY[r.urgency]}
                  </span>
                  <span className="text-ash font-sans text-[0.85rem]">
                    {STATUS[r.status]}
                    {r.claimedBy ? ` by ${memberNames[r.claimedBy] ?? r.claimedBy}` : ''}
                  </span>
                </div>
                <p className="mt-2 max-w-[64ch] leading-relaxed">{r.description}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-sans text-[0.95rem]">
                  <dt className="text-ash">Where</dt>
                  <dd>{[r.zip, r.neighborhood].filter(Boolean).join(', ') || 'Not given'}</dd>
                  <dt className="text-ash">Contact</dt>
                  <dd>
                    {r.contact.name}
                    {r.contact.phone ? `, ${r.contact.phone}` : ''}
                    {r.contact.email ? `, ${r.contact.email}` : ''}
                    {r.contact.bestTime ? `. Best time: ${r.contact.bestTime}` : ''}
                  </dd>
                  <dt className="text-ash">Received</dt>
                  <dd>
                    {formatShortDate(r.createdAt)}. Ref {r.ref}
                    {r.owner === 'local' ? ' (sent from this browser)' : ''}
                  </dd>
                  {r.notes && (
                    <>
                      <dt className="text-ash">Notes</dt>
                      <dd>{r.notes}</dd>
                    </>
                  )}
                </dl>
              </div>
              <div className="flex flex-col gap-2 font-sans">
                {r.status === 'open' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => requests.claim(r.id, me))}
                    className="bg-brick text-paper hover:bg-kiln px-4 py-2.5 font-semibold disabled:opacity-60"
                  >
                    {busy === r.id ? 'Saving' : 'Claim this job'}
                  </button>
                )}
                {(r.status === 'open' || r.status === 'claimed') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[0.9rem]">
                      <span className="sr-only">Referral note</span>
                      <input
                        value={referNote[r.id] ?? ''}
                        onChange={(e) => setReferNote((p) => ({ ...p, [r.id]: e.target.value }))}
                        placeholder="Refer to whom, and why"
                        className="border-charcoal bg-paper w-full border-2 px-3 py-2"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy === r.id || !(referNote[r.id] ?? '').trim()}
                      onClick={() => act(r.id, () => requests.refer(r.id, referNote[r.id]))}
                      className="border-charcoal hover:bg-charcoal hover:text-stone border-2 px-4 py-2 font-semibold disabled:opacity-40"
                    >
                      Refer
                    </button>
                  </div>
                )}
                {r.status !== 'closed' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => requests.close(r.id))}
                    className="decoration-brass px-1 py-1 text-left font-medium underline decoration-2 underline-offset-4"
                  >
                    Mark closed
                  </button>
                )}
                {r.status !== 'open' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => requests.reopen(r.id))}
                    className="text-ash decoration-mortar px-1 py-1 text-left font-medium underline decoration-2 underline-offset-4"
                  >
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
