import { useEffect, useRef, useState } from 'react';
import { portal, type TradesmanRow } from '@/lib/api-portal';
import { docs, signing, type MemberDoc, type SendResult } from '@/lib/api-docs';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import { DocRow } from '../admin/DocumentsReview';
import { MemberEditById } from '../admin/MembersAdmin';
import InvitationsPanel, { type InvitePrefill } from '../admin/InvitationsPanel';
import SigningPanel from '../admin/SigningPanel';
import DocumentsReview from '../admin/DocumentsReview';
import MembersAdmin from '../admin/MembersAdmin';
import { ErrorStrip, Loading, msg, Status } from '../ui';
import {
  Badge,
  Card,
  Checklist,
  Dot,
  pBtn,
  pBtnQuiet,
  pLink,
  SubTabs,
  type Tone,
} from '../layout';

type Filter = 'all' | 'action' | 'listed' | 'unlisted';
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['action', 'Needs action'],
  ['listed', 'Listed'],
  ['unlisted', 'Not listed'],
];
type Sign = TradesmanRow['signRequests'][number];

/** The merged People page, with the full older screens one tab over so nothing is lost. */
export default function TradesmenPage({ areas, initial }: { areas: string[]; initial?: string }) {
  return (
    <SubTabs
      label="Tradesmen views"
      initial={initial}
      tabs={[
        { id: 'people', label: 'Tradesmen', content: <Roster areas={areas} /> },
        { id: 'paperwork', label: 'All paperwork', content: <SigningPanel /> },
        { id: 'documents', label: 'All documents', content: <DocumentsReview /> },
        { id: 'entries', label: 'All directory entries', content: <MembersAdmin areas={areas} /> },
      ]}
    />
  );
}

function Roster({ areas }: { areas: string[] }) {
  const { data, loading, error } = useResource(() => portal.tradesmen(), []);
  const [filter, setFilter] = useState<Filter>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('show') === 'action'
      ? 'action'
      : 'all',
  );
  const [selId, setSelId] = useState<string | null>(null);
  const [inviting, setInviting] = useState<InvitePrefill | 'blank' | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const all = data ?? [];
  const shown = all.filter((t) =>
    filter === 'action'
      ? t.needsAction
      : filter === 'listed'
        ? t.listed
        : filter === 'unlisted'
          ? !t.listed
          : true,
  );
  const sel = all.find((t) => t.id === selId) ?? shown[0] ?? null;
  // Remember an auto-selected first row, so after an action the same person
  // stays selected (even if they leave the current filter) and the status
  // message beside them stays visible.
  useEffect(() => {
    if (sel && sel.id !== selId) setSelId(sel.id);
  }, [sel, selId]);

  function pick(id: string) {
    setSelId(id);
    setInviting(null);
    // On a phone the detail sits below the list; bring it into view.
    if (window.matchMedia('(max-width: 1023px)').matches)
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,0.9fr)_1.6fr]">
      <Card
        className="self-start"
        title={data ? `${all.length} ${all.length === 1 ? 'tradesman' : 'tradesmen'}` : 'Tradesmen'}
        action={
          <button type="button" className={pBtnQuiet} onClick={() => setInviting('blank')}>
            Invite
          </button>
        }
      >
        <div role="group" aria-label="Show" className="mb-3 flex flex-wrap gap-2 font-sans text-[0.85rem]">
          {FILTERS.map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 font-semibold ${filter === f ? 'bg-charcoal text-stone border-charcoal' : 'border-mortar hover:border-charcoal'}`}
            >
              {label}
              {f === 'action' && data ? ` (${all.filter((t) => t.needsAction).length})` : ''}
            </button>
          ))}
        </div>
        {error && <ErrorStrip>{error}</ErrorStrip>}
        {loading && !data && <Loading what="tradesmen" />}
        {data && shown.length === 0 && (
          <p className="text-ash font-sans">
            {filter === 'action' ? 'Nobody needs anything from an officer.' : 'Nobody here yet.'}
          </p>
        )}
        <ul className="-mx-2 flex flex-col font-sans">
          {shown.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => pick(x.id)}
                aria-current={sel?.id === x.id ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2.5 text-left ${sel?.id === x.id ? 'bg-stone ring-brass ring-2' : 'hover:bg-stone'}`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{x.name}</span>
                  <span className="text-ash text-[0.85rem]">
                    {x.trade || 'No trade yet'} · {x.note}
                  </span>
                </span>
                <Dot tone={x.tone} />
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div ref={detailRef} className="flex min-w-0 scroll-mt-4 flex-col gap-6">
        {inviting ? (
          <Card
            title="Invite to the portal"
            action={
              <button type="button" className={pBtnQuiet} onClick={() => setInviting(null)}>
                Close
              </button>
            }
          >
            <InvitationsPanel
              key={inviting === 'blank' ? 'blank' : inviting.memberId}
              prefill={inviting === 'blank' ? null : inviting}
              onClearPrefill={() => setInviting('blank')}
            />
          </Card>
        ) : sel ? (
          <Detail key={sel.id} t={sel} areas={areas} onInvite={setInviting} />
        ) : data ? (
          <Card>
            <p className="text-ash font-sans">Pick someone from the list.</p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

const SIGN_WORD: Record<string, string> = { sent: 'Sent', viewed: 'Opened', signed: 'Signed' };

function signBadge(r: Sign): { tone: Tone; text: string } {
  if (r.status === 'signed')
    return { tone: 'done', text: `Signed ${formatShortDate(r.signedAt ?? r.sentAt)}` };
  if (r.expired) return { tone: 'attention', text: 'Link expired' };
  return {
    tone: 'waiting',
    text: `${SIGN_WORD[r.status] ?? r.status} ${formatShortDate(r.viewedAt ?? r.sentAt)}, not signed`,
  };
}

function Detail({
  t,
  areas,
  onInvite,
}: {
  t: TradesmanRow;
  areas: string[];
  onInvite: (p: InvitePrefill) => void;
}) {
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const email = t.privateEmail || t.accountEmail || '';
  const pending = t.documents.filter((d) => d.status === 'pending');
  const others = t.documents.filter((d) => d.status !== 'pending');
  const hasOpenPacket = t.signRequests.some(
    (r) => r.docKind === 'listing-packet' && (r.status === 'sent' || r.status === 'viewed'),
  );
  const signedPacket = t.checklist[0]?.tone === 'done';

  useEffect(() => setCopied(false), [link]);

  function report(r: SendResult, what: string) {
    setStatus(
      r.emailed
        ? `${what} ${r.request.signerEmail}. The link works for 30 days.`
        : `${what} ${r.request.signerEmail}, but the email could not be sent (${r.mailError ?? 'mail is not set up'}). Copy the link below and send it yourself.`,
    );
    setLink({ id: r.request.id, url: r.link });
  }
  async function act(fn: () => Promise<void>, fallback: string) {
    setErr('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(msg(e, fallback));
    } finally {
      setBusy(false);
    }
  }
  const sendPacket = () =>
    act(async () => {
      if (!email) throw new Error('Add a private email to the directory entry first.');
      report(
        await signing.send({ docKind: 'listing-packet', memberId: t.id, name: t.name, email }),
        'Sent the listing packet to',
      );
    }, 'Could not send it.');
  const resend = (r: Sign) => {
    if (!window.confirm(`Send ${r.signerName} a new link? The old link will stop working.`)) return;
    void act(async () => report(await signing.resend(r.id), 'Sent a new link to'), 'Could not re-send.');
  };
  const voidIt = (r: Sign) => {
    if (!window.confirm(`Void the request to ${r.signerName}? The link will stop working.`)) return;
    void act(async () => {
      await signing.void(r.id);
      setStatus(`Voided the ${r.title}.`);
      if (link?.id === r.id) setLink(null);
    }, 'Could not void it.');
  };
  async function review(d: MemberDoc, patch: Parameters<typeof docs.review>[1], what: string) {
    await act(async () => {
      await docs.review(d.id, patch);
      setStatus(`${what}: ${d.kindLabel}, ${d.filename}.`);
    }, 'Could not save that.');
  }
  async function remove(d: MemberDoc) {
    if (!window.confirm(`Delete ${d.filename} for good?`)) return;
    await act(async () => {
      await docs.remove(d.id);
      setStatus(`Deleted ${d.filename}.`);
    }, 'Could not delete that.');
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="border-mortar bg-paper flex flex-wrap items-center gap-4 rounded-md border p-5">
        <div className="bg-mortar/60 text-ash flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-sm font-sans text-[0.75rem]">
          {t.photo ? (
            <img src={t.photo} alt={`Portrait of ${t.name}`} className="h-full w-full object-cover" />
          ) : (
            'No photo'
          )}
        </div>
        <div className="min-w-0 font-sans">
          <h2 className="font-serif text-[1.5rem] leading-tight">{t.name}</h2>
          <p className="text-ash break-words">
            {[t.trade, t.privateEmail, t.privatePhone].filter(Boolean).join(' · ') ||
              'No trade or contact details yet'}
          </p>
          <p className="text-ash text-[0.85rem]">
            {t.accountEmail
              ? `Portal login: ${t.accountEmail}`
              : t.invited
                ? 'Invited, no login yet'
                : 'No portal login'}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge tone={t.listed ? 'done' : 'neutral'}>{t.listed ? 'Listed' : 'Not listed'}</Badge>
          {!t.accountEmail && (
            <button
              type="button"
              className={pBtnQuiet}
              onClick={() =>
                onInvite({
                  email: t.privateEmail,
                  name: t.name,
                  phone: t.privatePhone,
                  memberId: t.id,
                })
              }
            >
              {t.invited ? 'Invite again' : 'Invite'}
            </button>
          )}
        </div>
      </div>

      {err && <ErrorStrip>{err}</ErrorStrip>}
      {status && <Status>{status}</Status>}
      {link && (
        <div className="border-brass bg-paper flex flex-col gap-2 rounded-sm border-l-4 px-4 py-3 font-sans text-[0.95rem]">
          <span className="font-semibold">Signing link (shown once)</span>
          <code className="break-all">{link.url}</code>
          <div className="flex gap-4">
            <button type="button" className={pLink} onClick={() => copy(link.url)}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" className="text-ash font-sans underline" onClick={() => setLink(null)}>
              Hide
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Checklist">
          <Checklist items={t.checklist} />
        </Card>
        <Card
          title="Paperwork"
          action={
            !signedPacket && !hasOpenPacket ? (
              <button type="button" className={pBtn} onClick={sendPacket} disabled={busy}>
                Send packet
              </button>
            ) : undefined
          }
        >
          {t.signRequests.length === 0 ? (
            <p className="text-ash font-sans">
              Nothing sent yet.{' '}
              {email ? `The packet goes to ${email}.` : 'Add a private email to send the packet.'}
            </p>
          ) : (
            <ul className="divide-mortar flex flex-col divide-y font-sans text-[0.95rem]">
              {t.signRequests.map((r) => {
                const open = r.status === 'sent' || r.status === 'viewed';
                const b = signBadge(r);
                return (
                  <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{r.title}</span>
                      <Badge tone={b.tone}>{b.text}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {open && (
                        <>
                          <button
                            type="button"
                            className={pBtnQuiet}
                            onClick={() => resend(r)}
                            disabled={busy}
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            className={pBtnQuiet}
                            onClick={() => voidIt(r)}
                            disabled={busy}
                          >
                            Void
                          </button>
                        </>
                      )}
                      {r.hasPdf && (
                        <a href={signing.pdfUrl(r.id)} className={pLink}>
                          Download signed PDF
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Documents to review">
        {pending.length === 0 ? (
          <p className="text-ash font-sans">Nothing waiting for review.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((d) => (
              <DocRow key={d.id} d={d} onReview={review} onRemove={remove} />
            ))}
          </ul>
        )}
        {others.length > 0 && (
          <details className="mt-4 font-sans">
            <summary className="cursor-pointer font-semibold">
              Reviewed documents ({others.length})
            </summary>
            <ul className="mt-3 flex flex-col gap-4">
              {others.map((d) => (
                <DocRow key={`${d.id}-${d.status}`} d={d} onReview={review} onRemove={remove} />
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Card
        title="Directory entry"
        action={
          <button
            type="button"
            className={pBtnQuiet}
            onClick={() => setEditing((e) => !e)}
            aria-expanded={editing}
          >
            {editing ? 'Close' : 'Edit'}
          </button>
        }
      >
        {editing ? (
          <MemberEditById id={t.id} areas={areas} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex flex-col gap-2 font-sans">
            <p>
              {[
                t.trade,
                `${t.yearsInTrade} ${t.yearsInTrade === 1 ? 'year' : 'years'}`,
                t.areas.join(', '),
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {t.bio && <p className="italic">“{t.bio}”</p>}
            <p className="text-ash text-[0.9rem]">
              Phone and email {t.showContact ? 'shown' : 'hidden'} in the directory. Only the
              tradesman can change this.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
