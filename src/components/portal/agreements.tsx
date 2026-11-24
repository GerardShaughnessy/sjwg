import { useState } from 'react';
import { agreements as api, users, type AgreementKind, type AgreementStatus } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import { ErrorStrip, inputCls, msg, Status } from './ui';
import { Badge, Card, pBtn, pBtnQuiet, pLink } from './layout';

/** Officer and board agreements in the portal: the banner, the to-do, and the Admin's controls. */
export const NOUN: Record<AgreementKind, string> = {
  'officer-agreement': 'officer agreement',
  'board-agreement': 'board agreement',
};
const TITLE: Record<AgreementKind, string> = {
  'officer-agreement': 'Officer agreement',
  'board-agreement': 'Board agreement',
};

/** The words and tone for one status: Not sent, Sent, not signed, or Signed <date>. */
export function statusBadge(st: AgreementStatus | undefined) {
  if (!st || st.state === 'not_sent') return <Badge tone="neutral">Not sent</Badge>;
  if (st.state === 'sent') return <Badge tone="waiting">Sent, not signed</Badge>;
  return <Badge tone="done">Signed {st.signedAt ? formatShortDate(st.signedAt) : ''}</Badge>;
}

const waiting = (list: AgreementStatus[] | undefined) =>
  (list ?? []).filter((a) => a.state === 'sent' && a.requestId);

/**
 * The prominent strip at the top of every portal page while a sent agreement
 * waits for a signature. Drafts for now, so it never blocks anything.
 */
export function AgreementBanner({ agreements }: { agreements: AgreementStatus[] | undefined }) {
  const open = waiting(agreements);
  if (open.length === 0) return null;
  return (
    <div className="mb-6 flex flex-col gap-3">
      {open.map((a) => (
        <section
          key={a.kind}
          aria-labelledby={`agreement-banner-${a.kind}`}
          className="border-brick bg-paper flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-l-8 px-4 py-3 font-sans"
        >
          <div className="min-w-0">
            <h2 id={`agreement-banner-${a.kind}`} className="text-[1.05rem] font-semibold">
              Please read and sign your {NOUN[a.kind]}
            </h2>
            <p className="text-ash text-[0.9rem]">
              The Admin sent it{a.sentAt ? ` on ${formatShortDate(a.sentAt)}` : ''}. It is a draft
              for attorney review, so the portal keeps working while you read it.
            </p>
          </div>
          <a href={api.signUrl(a.requestId!)} className={pBtn}>
            Sign now
          </a>
        </section>
      ))}
    </div>
  );
}

/** The to-do on an officer's Dashboard or a director's Home. */
export function AgreementTodo({ agreements }: { agreements: AgreementStatus[] | undefined }) {
  const open = waiting(agreements);
  if (open.length === 0) return null;
  return (
    <Card title="To do">
      <ul className="divide-mortar flex flex-col divide-y font-sans">
        {open.map((a) => (
          <li
            key={a.kind}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="font-semibold">Sign your {NOUN[a.kind]}</p>
              <p className="text-ash text-[0.9rem]">
                Read it, then sign with your typed name. You get a signed PDF by email.
              </p>
            </div>
            <a href={api.signUrl(a.requestId!)} className={pBtn}>
              Sign now
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** "Your officer agreement: Signed Nov 24, 2026 (PDF)" on the person's own card. */
export function MyAgreementLine({ kind }: { kind: AgreementKind }) {
  const { data } = useResource(() => api.mine(), []);
  const st = data?.find((a) => a.kind === kind);
  if (!data || !st) return null;
  return (
    <div className="border-mortar flex flex-wrap items-center gap-2 border-t pt-3 text-[0.95rem]">
      <span className="font-semibold">Your {NOUN[kind]}</span>
      {statusBadge(st)}
      {st.state === 'sent' && st.requestId && (
        <a href={api.signUrl(st.requestId)} className={pLink}>
          Sign now
        </a>
      )}
      {st.state === 'signed' && st.hasPdf && st.requestId && (
        <a href={api.pdfUrl(st.requestId)} className={pLink}>
          Signed PDF
        </a>
      )}
      {st.state === 'not_sent' && <span className="text-ash">The Admin has not sent it yet.</span>}
    </div>
  );
}

/** The Admin's controls for one person: status, then Send, or Resend and Void. */
export function AgreementControls({
  kind,
  userId,
  name,
  status,
}: {
  kind: AgreementKind;
  userId: string;
  name: string;
  status: AgreementStatus | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const first = name.split(' ')[0];

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const r = (await fn()) as
        { emailed?: boolean; message?: string | null; existing?: boolean } | undefined;
      const said = r?.existing
        ? 'It was already sent. Use Resend to email a new link.'
        : r?.message
          ? `${done} ${r.message}`
          : done;
      setNote(r && r.emailed === false && !r.existing ? `${said} The email did not go out.` : said);
    } catch (e) {
      setErr(msg(e, 'Could not do that.'));
    } finally {
      setBusy(false);
    }
  }

  const st = status;
  return (
    <div className="border-mortar flex flex-col gap-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[0.9rem] font-semibold">{TITLE[kind]}</span>
        {statusBadge(st)}
        {st?.state === 'signed' && st.hasPdf && st.requestId && (
          <a href={api.pdfUrl(st.requestId)} className={`${pLink} text-[0.9rem]`}>
            PDF
          </a>
        )}
      </div>
      {st?.state !== 'signed' && (
        <div className="flex flex-wrap items-center gap-2">
          {!st || st.state === 'not_sent' ? (
            <button
              type="button"
              className={pBtnQuiet}
              disabled={busy}
              aria-busy={busy}
              onClick={() =>
                act(() => api.send(kind, userId), `Sent the ${NOUN[kind]} to ${first}.`)
              }
            >
              {busy ? 'Sending…' : `Send ${NOUN[kind]}`}
            </button>
          ) : (
            <>
              <button
                type="button"
                className={pBtnQuiet}
                disabled={busy}
                onClick={() => act(() => api.resend(st.requestId!), `Sent ${first} a new link.`)}
              >
                Resend
              </button>
              <button
                type="button"
                className={pBtnQuiet}
                disabled={busy}
                onClick={() =>
                  act(() => api.void(st.requestId!), `Withdrew the ${NOUN[kind]} sent to ${first}.`)
                }
              >
                Void
              </button>
            </>
          )}
        </div>
      )}
      {err && <ErrorStrip>{err}</ErrorStrip>}
      <Status>{note}</Status>
    </div>
  );
}

/** "Send to every officer who hasn't signed" for the top of the page. */
export function SendAllAgreements({
  kind,
  statuses,
  who,
}: {
  kind: AgreementKind;
  statuses: AgreementStatus[];
  /** "officer" or "director" */
  who: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const mine = statuses.filter((s) => s.kind === kind);
  const unsigned = mine.filter((s) => s.state !== 'signed').length;
  const signed = mine.length - unsigned;

  async function go() {
    setBusy(true);
    setErr('');
    setNote('');
    try {
      const r = await api.sendAll(kind);
      const parts = [
        r.sent.length ? `Sent to ${r.sent.length}.` : '',
        r.resent.length ? `New link to ${r.resent.length}.` : '',
        r.replaced.length
          ? `Voided and sent fresh with their current title and duties: ${r.replaced.join(', ')}.`
          : '',
        r.failed.length ? `Did not go out for ${r.failed.join(', ')}.` : '',
      ].filter(Boolean);
      setNote(parts.join(' ') || 'Everyone has signed.');
    } catch (e) {
      setErr(msg(e, 'Could not send them.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`${TITLE[kind]}s`}>
      <div className="flex flex-col gap-3 font-sans">
        <p className="text-ash text-[0.95rem]">
          A draft for attorney review. Each {who} gets it with their name, title, and duties filled
          in. {signed} of {mine.length} signed.{' '}
          <a href={`/documents/${kind}`} className={pLink}>
            Read the draft
          </a>
        </p>
        <div>
          <button
            type="button"
            className={pBtn}
            disabled={busy || unsigned === 0}
            aria-busy={busy}
            onClick={go}
          >
            {busy ? 'Sending…' : `Send to every ${who} who hasn't signed`}
          </button>
        </div>
        {err && <ErrorStrip>{err}</ErrorStrip>}
        <Status>{note}</Status>
      </div>
    </Card>
  );
}

/** "Primary duties, one per line", saved to the account and merged into both agreements. */
export function DutiesEditor({ userId, duties }: { userId: string; duties: string }) {
  const [text, setText] = useState(duties);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const id = `duties-${userId}`;
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setNote('');
    try {
      await users.update(userId, { duties: text.trim() });
      setNote(
        text.trim() ? 'Duties saved.' : 'Duties cleared. The agreement will use a general list.',
      );
    } catch (e2) {
      setErr(msg(e2, 'Could not save the duties.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="flex flex-col gap-1" onSubmit={save}>
      <label htmlFor={id} className="text-[0.9rem] font-semibold">
        Primary duties, one per line
      </label>
      <span id={`${id}-hint`} className="text-ash text-[0.85rem]">
        Merged into their agreements. Left blank, a general list is used.
      </span>
      <textarea
        id={id}
        aria-describedby={`${id}-hint`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={4000}
        className={`${inputCls} py-1.5 text-[0.95rem]`}
      />
      <div>
        <button
          type="submit"
          className={pBtnQuiet}
          disabled={busy || text.trim() === duties.trim()}
        >
          Save duties
        </button>
      </div>
      {err && <ErrorStrip>{err}</ErrorStrip>}
      <Status>{note}</Status>
    </form>
  );
}
