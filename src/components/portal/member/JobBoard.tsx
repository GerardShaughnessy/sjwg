import { useEffect, useState } from 'react';
import type { RequestStatus, Session, Urgency } from '@/lib/types';
import {
  ApiError,
  members as membersApi,
  requests,
  type MemberBrief,
  type RequestEvent,
  type RequestNote,
  type RequestView,
} from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import {
  btnMuted,
  btnPrimary,
  btnQuiet,
  btnSecondary,
  ErrorStrip,
  inputCls,
  Loading,
  msg,
} from '../ui';

const STATUS: Record<RequestStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  referred: 'Referred',
  closed: 'Closed',
};
const URGENCY: Record<Urgency, string> = {
  'can-wait': 'Can wait',
  'getting-worse': 'Getting worse',
  'no-heat-or-water': 'No heat, water, or not safe',
};
const ACTION: Record<string, string> = {
  created: 'sent the request',
  claimed: 'claimed it',
  referred: 'referred it',
  closed: 'closed it',
  reopened: 'reopened it',
  note_added: 'added a note',
  photo_added: 'added a photo',
  email_sent: 'was emailed',
};

function when(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(new Date(iso));
}

/** Help requests from the public form, live from the database. */
export default function JobBoard({ session }: { session: Session }) {
  const [filter, setFilter] = useState<RequestStatus | 'active' | 'all'>('active');
  const { data, loading, error } = useResource(() => requests.list(filter), [filter]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [referNote, setReferNote] = useState<Record<string, string>>({});
  const [referTo, setReferTo] = useState<Record<string, string>>({});
  const [referResult, setReferResult] = useState<Record<string, string>>({});
  const roster = useResource(() => membersApi.list() as Promise<MemberBrief[]>, []);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('request');
    if (wanted) setOpen(wanted);
  }, []);

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setActionError((e) => ({ ...e, [id]: '' }));
    try {
      await fn();
    } catch (err) {
      setActionError((e) => ({ ...e, [id]: msg(err, 'That did not save. Try again.') }));
    } finally {
      setBusy(null);
    }
  }

  const list = data ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2">Job board</h2>
          <p className="text-ash mt-2 max-w-[56ch] font-sans text-[0.95rem]">
            Requests from the public form. Claim one to take it, refer it to another member, or
            close it when done. Notes marked visible go to the requester by email.
          </p>
        </div>
        <label className="font-sans text-[0.95rem]">
          <span className="mr-2 font-semibold">Show</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className={inputCls}
          >
            <option value="active">Open, claimed, referred</option>
            <option value="open">Open</option>
            <option value="claimed">Claimed</option>
            <option value="referred">Referred</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-6">
          <ErrorStrip>{error}</ErrorStrip>
        </div>
      )}
      {loading && !data && (
        <div className="mt-6">
          <Loading what="requests" />
        </div>
      )}
      {data && list.length === 0 && (
        <p className="border-brass bg-paper mt-8 border-t-4 p-6">
          Nothing {filter === 'all' ? 'yet' : filter === 'active' ? 'open' : filter} right now.
        </p>
      )}
      {list.length > 0 && (
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
                    {r.claimedByName ? ` by ${r.claimedByName}` : ''}
                    {r.claimedAt ? `, ${formatShortDate(r.claimedAt)}` : ''}
                  </span>
                </div>
                <p className="mt-2 max-w-[64ch] leading-relaxed whitespace-pre-wrap">
                  {r.description}
                </p>
                {r.photos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.photos.map((p) => (
                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                        <img
                          src={p.url}
                          alt={`Photo sent with request ${r.ref}`}
                          className="border-mortar h-24 w-24 border object-cover"
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
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
                    {r.source === 'seed' ? ' (sample)' : ''}
                  </dd>
                  {r.notes && (
                    <>
                      <dt className="text-ash">Referral</dt>
                      <dd>{r.notes}</dd>
                    </>
                  )}
                </dl>
                <button
                  type="button"
                  onClick={() => setOpen(open === r.id ? null : r.id)}
                  className={`${btnQuiet} mt-3`}
                  aria-expanded={open === r.id}
                >
                  {open === r.id
                    ? 'Hide notes and history'
                    : `Notes and history${r.noteCount ? ` (${r.noteCount})` : ''}`}
                </button>
                {open === r.id && <History request={r} session={session} />}
              </div>
              <div className="flex flex-col gap-2 font-sans">
                {r.status === 'open' && (
                  <button
                    type="button"
                    disabled={busy === r.id || !session.memberId}
                    onClick={() => act(r.id, () => requests.claim(r.id))}
                    className={btnPrimary}
                  >
                    {busy === r.id ? 'Saving' : 'Claim this job'}
                  </button>
                )}
                {!session.memberId && r.status === 'open' && (
                  <p className="text-ash text-[0.85rem]">
                    Your account is not linked to a directory entry, so you cannot claim. Ask an
                    officer.
                  </p>
                )}
                {(r.status === 'open' || r.status === 'claimed') && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[0.9rem]">
                      <span className="sr-only">Referral note</span>
                      <input
                        value={referNote[r.id] ?? ''}
                        onChange={(e) => setReferNote((p) => ({ ...p, [r.id]: e.target.value }))}
                        placeholder="Refer to whom, and why"
                        className={`${inputCls} w-full`}
                      />
                    </label>
                    <label className="text-[0.9rem]">
                      <span className="sr-only">Refer to a member</span>
                      <select
                        value={referTo[r.id] ?? ''}
                        onChange={(e) => setReferTo((p) => ({ ...p, [r.id]: e.target.value }))}
                        className={`${inputCls} w-full`}
                      >
                        <option value="">Refer to a member</option>
                        {(roster.data ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.trade})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy === r.id || (!(referNote[r.id] ?? '').trim() && !referTo[r.id])
                      }
                      onClick={() =>
                        act(r.id, async () => {
                          const res = await requests.refer(r.id, {
                            memberId: referTo[r.id] || null,
                            note: referNote[r.id] ?? '',
                          });
                          setReferResult((p) => ({
                            ...p,
                            [r.id]: referTo[r.id]
                              ? res.emailed
                                ? 'Referred and emailed.'
                                : res.hasEmail
                                  ? 'Referred. The email could not be sent just now.'
                                  : 'Referred. He has no email on file, so call him.'
                              : 'Referred.',
                          }));
                        })
                      }
                      className={btnSecondary}
                    >
                      Refer
                    </button>
                    {referResult[r.id] && (
                      <p className="text-ash text-[0.85rem]">{referResult[r.id]}</p>
                    )}
                  </div>
                )}
                {r.status !== 'closed' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => requests.close(r.id))}
                    className={btnQuiet}
                  >
                    Mark closed
                  </button>
                )}
                {r.status !== 'open' && (
                  <button
                    type="button"
                    disabled={busy === r.id}
                    onClick={() => act(r.id, () => requests.reopen(r.id))}
                    className={btnMuted}
                  >
                    Reopen
                  </button>
                )}
                {actionError[r.id] && (
                  <p role="alert" className="text-brick text-[0.9rem] font-semibold">
                    {actionError[r.id]}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function History({ request, session }: { request: RequestView; session: Session }) {
  const { data, loading, error } = useResource(() => requests.history(request.id), [request.id]);
  const [body, setBody] = useState('');
  const [visible, setVisible] = useState(true);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) {
      setStatus('Write something first.');
      return;
    }
    setPending(true);
    setStatus('');
    try {
      const { emailed } = await requests.addNote(request.id, body.trim(), visible);
      setBody('');
      setStatus(
        visible
          ? emailed
            ? `Saved and emailed to ${request.contact.name}.`
            : request.contact.email
              ? 'Saved. The email could not be sent just now.'
              : 'Saved. They gave no email, so call them.'
          : 'Saved as an internal note.',
      );
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : 'Could not save the note.');
    } finally {
      setPending(false);
    }
  }

  const items: { at: string; text: string; kind: 'note' | 'event'; internal?: boolean }[] = [
    ...(data?.notes ?? []).map((n: RequestNote) => ({
      at: n.createdAt,
      kind: 'note' as const,
      internal: !n.visibleToRequester,
      text: `${n.authorKind === 'requester' ? request.contact.name : (n.authorName ?? 'A member')}: ${n.body}`,
    })),
    ...(data?.events ?? [])
      .filter((ev: RequestEvent) => ev.action !== 'note_added')
      .map((ev: RequestEvent) => ({
        at: ev.createdAt,
        kind: 'event' as const,
        text: `${ev.actorKind === 'system' ? 'System' : (ev.actorName ?? (ev.actorKind === 'requester' ? request.contact.name : 'A member'))} ${ACTION[ev.action] ?? ev.action}${ev.detail && typeof ev.detail.note === 'string' ? `: ${ev.detail.note}` : ''}`,
      })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return (
    <div className="border-mortar mt-3 border-l-2 pl-4">
      {error && <ErrorStrip>{error}</ErrorStrip>}
      {loading && !data && <Loading what="history" />}
      {data && (
        <ol className="flex flex-col gap-2 font-sans text-[0.95rem]">
          {items.map((it, i) => (
            <li key={i} className={it.kind === 'event' ? 'text-ash' : ''}>
              <span className="text-ash text-[0.85rem]">{when(it.at)}</span> {it.text}
              {it.internal && (
                <span className="bg-mortar/50 ml-2 px-1.5 py-0.5 text-[0.8rem]">internal</span>
              )}
            </li>
          ))}
          {items.length === 0 && <li className="text-ash">No history yet.</li>}
        </ol>
      )}
      <form onSubmit={send} className="mt-4 flex flex-col gap-2 font-sans">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Add a note</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </label>
        <label className="flex items-center gap-2 text-[0.95rem]">
          <input
            type="checkbox"
            className="accent-brick h-5 w-5"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
          />
          Show to {request.contact.name} on their tracking page
          {request.contact.email ? ' and email it' : ''}
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnSecondary}>
            {pending ? 'Saving' : 'Save note'}
          </button>
          <span role="status" aria-live="polite" className="text-ash text-[0.9rem]">
            {status} {session.name ? '' : ''}
          </span>
        </div>
      </form>
    </div>
  );
}
