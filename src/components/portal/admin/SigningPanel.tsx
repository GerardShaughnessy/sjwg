import { useState } from 'react';
import { members as membersApi, type MemberAdmin } from '@/lib/api';
import { signing, type SendResult, type SignRequestView } from '@/lib/api-docs';
import { useResource } from '@/lib/hooks';
import { SIGN_DOC_KINDS } from '@/config/documents';
import { formatShortDate } from '@/lib/events';
import {
  btnMuted,
  btnPrimary,
  btnQuiet,
  ErrorStrip,
  inputCls,
  Labeled,
  Loading,
  msg,
  Status,
} from '../ui';

const STATUS_LABEL: Record<string, string> = {
  sent: 'Sent',
  viewed: 'Opened',
  signed: 'Signed',
  voided: 'Voided',
};

/**
 * Officers send Guild documents for e-signature by emailed link and follow
 * each request. Sending is the Guild's side of the signature.
 */
export default function SigningPanel() {
  const people = useResource(() => membersApi.list(), []);
  const requests = useResource(() => signing.list(), []);
  const [memberId, setMemberId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [docKind, setDocKind] = useState('listing-packet');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const roster = ((people.data ?? []) as MemberAdmin[])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  function pick(id: string) {
    setMemberId(id);
    const m = roster.find((r) => r.id === id);
    if (m) {
      setName(m.name);
      setEmail(m.privateEmail ?? '');
    }
  }

  function report(r: SendResult, what: string) {
    setStatus(
      r.emailed
        ? `${what} ${r.request.signerEmail}. The link works for 30 days.`
        : `${what} ${r.request.signerEmail}, but the email could not be sent (${r.mailError ?? 'mail is not set up'}). Copy the link below and send it to him yourself.`,
    );
    setCopied(false);
    setLink({ id: r.request.id, url: r.link });
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setFields({});
    setPending(true);
    try {
      const r = await signing.send({
        docKind,
        memberId: memberId || null,
        name: name.trim(),
        email: email.trim(),
      });
      report(r, 'Sent to');
      setMemberId('');
      setName('');
      setEmail('');
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setError(msg(err, 'Could not send it.'));
    } finally {
      setPending(false);
    }
  }

  async function resend(r: SignRequestView) {
    if (!window.confirm(`Send ${r.signerName} a new link? The old link will stop working.`)) return;
    setError('');
    try {
      report(await signing.resend(r.id), 'Sent a new link to');
    } catch (err) {
      setError(msg(err, 'Could not re-send.'));
    }
  }
  async function voidIt(r: SignRequestView) {
    if (!window.confirm(`Void the request to ${r.signerName}? The link will stop working.`)) return;
    setError('');
    try {
      await signing.void(r.id);
      setStatus(`Voided the ${r.title} for ${r.signerName}.`);
      if (link?.id === r.id) setLink(null);
    } catch (err) {
      setError(msg(err, 'Could not void it.'));
    }
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
    <div className="flex flex-col gap-10 font-sans">
      <form onSubmit={send} className="flex max-w-[48ch] flex-col gap-5" noValidate>
        <h2 className="text-h2 font-serif">Send for signature</h2>
        <p className="text-ash text-[0.95rem]">
          He gets a private link by email, agrees to sign electronically, reads the document, and
          signs with his typed name. You both get a signed PDF. Sending it signs for the Guild in
          your name. Drafts can be sent for testing; they carry a draft banner.
        </p>
        <Labeled
          label="Tradesman"
          hint="Fills in his name and private email. Leave blank to type them yourself."
        >
          <select value={memberId} onChange={(e) => pick(e.target.value)} className={inputCls}>
            <option value="">Someone not in the list</option>
            {roster.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.trade ? `, ${m.trade}` : ''}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Name" error={fields.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
        </Labeled>
        <Labeled label="Email" error={fields.email}>
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
        </Labeled>
        <Labeled label="Document" error={fields.docKind}>
          <select value={docKind} onChange={(e) => setDocKind(e.target.value)} className={inputCls}>
            {SIGN_DOC_KINDS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Labeled>
        <p className="text-[0.95rem]">
          <a href="/documents" target="_blank" rel="noopener" className={btnQuiet}>
            Read the documents first
          </a>
        </p>
        {error && <ErrorStrip>{error}</ErrorStrip>}
        {status && <Status>{status}</Status>}
        {link && (
          <div className="border-brass bg-paper flex flex-col gap-2 border-l-4 px-4 py-3 text-[0.95rem]">
            <span className="font-semibold">Signing link (shown once)</span>
            <code className="break-all">{link.url}</code>
            <div className="flex gap-4">
              <button type="button" className={btnQuiet} onClick={() => copy(link.url)}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button type="button" className={btnMuted} onClick={() => setLink(null)}>
                Hide
              </button>
            </div>
          </div>
        )}
        <div>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? 'Sending.' : 'Send'}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2 font-serif">Requests</h2>
        {requests.loading && !requests.data && <Loading what="signature requests" />}
        {requests.error && <ErrorStrip>{requests.error}</ErrorStrip>}
        {requests.data && requests.data.length === 0 && (
          <p className="text-ash">Nothing sent yet.</p>
        )}
        <ul className="flex flex-col gap-3">
          {(requests.data ?? []).map((r) => {
            const open = r.status === 'sent' || r.status === 'viewed';
            return (
              <li key={r.id} className="border-mortar flex flex-col gap-1 border-b pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">{r.signerName}</span>
                  <span className="text-ash text-[0.9rem]">{r.signerEmail}</span>
                  <span
                    className={`border-2 px-2 py-0.5 text-[0.85rem] font-semibold ${
                      r.status === 'signed'
                        ? 'border-charcoal bg-charcoal text-stone'
                        : r.status === 'voided'
                          ? 'border-mortar text-ash'
                          : 'border-brass'
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                    {open && r.expired ? ', link expired' : ''}
                  </span>
                </div>
                <div className="text-[0.95rem]">{r.title}</div>
                <div className="text-ash flex flex-wrap gap-x-4 text-[0.9rem]">
                  <span>
                    Sent {formatShortDate(r.sentAt)} by {r.sentByName}
                  </span>
                  {r.viewedAt && <span>Opened {formatShortDate(r.viewedAt)}</span>}
                  {r.signedAt && (
                    <span>
                      Signed {formatShortDate(r.signedAt)} as {r.signedName}
                    </span>
                  )}
                  {r.voidedAt && <span>Voided {formatShortDate(r.voidedAt)}</span>}
                </div>
                <div className="flex flex-wrap gap-4">
                  {open && (
                    <>
                      <button type="button" className={btnQuiet} onClick={() => resend(r)}>
                        Resend
                      </button>
                      <button type="button" className={btnMuted} onClick={() => voidIt(r)}>
                        Void
                      </button>
                    </>
                  )}
                  {link?.id === r.id && (
                    <button type="button" className={btnQuiet} onClick={() => copy(link.url)}>
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  )}
                  {r.hasPdf && (
                    <a href={signing.pdfUrl(r.id)} className={btnQuiet}>
                      Download signed PDF
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
