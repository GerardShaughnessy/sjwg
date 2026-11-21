import { useRef, useState } from 'react';
import type { Session } from '@/lib/types';
import { docs, signing, type MemberDoc } from '@/lib/api-docs';
import { useResource } from '@/lib/hooks';
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

/** Kept in step with MEMBER_DOC_KINDS in src/server/documents.ts (server code stays out of islands). */
export const DOC_KIND_OPTIONS = [
  { value: 'baptism', label: 'Baptism certificate' },
  { value: 'confirmation', label: 'Confirmation certificate' },
  { value: 'license', label: 'Trade license' },
  { value: 'insurance', label: 'Proof of insurance' },
  { value: 'w9', label: 'W-9' },
  { value: 'other', label: 'Other' },
] as const;
const EXPIRING = new Set(['license', 'insurance']);

/** "Jun 30, 2027" from a plain date, without a time zone shift. */
export function formatDay(d: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${d}T00:00:00Z`));
}

export function StatusTag({ status }: { status: MemberDoc['status'] }) {
  const cls = {
    pending: 'border-mortar text-ash',
    verified: 'border-charcoal bg-charcoal text-stone',
    rejected: 'border-brick text-brick',
  }[status];
  const label = { pending: 'Waiting for review', verified: 'Verified', rejected: 'Not accepted' }[
    status
  ];
  return (
    <span className={`border-2 px-2 py-0.5 text-[0.85rem] font-semibold ${cls}`}>{label}</span>
  );
}

/**
 * A tradesman's private papers: baptism and confirmation certificates,
 * license, insurance. Only Guild officers see them. Also lists paperwork
 * an officer sent him to sign.
 */
export default function MyDocuments({ session }: { session: Session }) {
  const list = useResource(() => docs.mine(), []);
  const paperwork = useResource(() => signing.mine(), []);
  const [kind, setKind] = useState<string>('baptism');
  const [expiresOn, setExpiresOn] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  if (!session.memberId || list.data?.hasMember === false) {
    return (
      <div className="flex max-w-[60ch] flex-col gap-3 font-sans">
        <h2 className="text-h2 font-serif">My documents</h2>
        <p className="leading-relaxed">
          Your login is not linked to a directory entry yet, so there is nowhere to keep your
          documents. Ask a Guild officer to link your account, or write to{' '}
          <a href="mailto:hello@sjwg.org" className="underline">
            hello@sjwg.org
          </a>
          .
        </p>
      </div>
    );
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setStatus('');
    if (!file) {
      setFields({ file: 'Choose a file to upload.' });
      return;
    }
    setFields({});
    setPending(true);
    try {
      await docs.upload({ file, kind, expiresOn: EXPIRING.has(kind) ? expiresOn : '' });
      setStatus(`Uploaded ${file.name}. A Guild officer will review it.`);
      setFile(null);
      setExpiresOn('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setError(msg(err, 'Could not upload that file.'));
    } finally {
      setPending(false);
    }
  }

  async function remove(d: MemberDoc) {
    if (!window.confirm(`Delete ${d.filename}?`)) return;
    try {
      await docs.remove(d.id);
      setStatus(`Deleted ${d.filename}.`);
    } catch (err) {
      setError(msg(err, 'Could not delete that.'));
    }
  }

  const open = (paperwork.data ?? []).filter((r) => r.status === 'sent' || r.status === 'viewed');
  const signed = (paperwork.data ?? []).filter((r) => r.status === 'signed');

  return (
    <div className="flex flex-col gap-12 font-sans">
      <section className="flex flex-col gap-4">
        <h2 className="text-h2 font-serif">Paperwork to sign</h2>
        {paperwork.loading && !paperwork.data && <Loading what="your paperwork" />}
        {paperwork.error && <ErrorStrip>{paperwork.error}</ErrorStrip>}
        {paperwork.data && open.length === 0 && (
          <p className="text-ash">Nothing to sign right now.</p>
        )}
        {open.length > 0 && (
          <ul className="flex flex-col gap-3">
            {open.map((r) => (
              <li
                key={r.id}
                className="border-brass bg-paper flex flex-wrap items-center justify-between gap-3 border-l-4 px-4 py-3"
              >
                <span>
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-ash block text-[0.9rem]">
                    Sent by {r.sentByName} on {formatShortDate(r.sentAt)}
                  </span>
                </span>
                <a href={`/sign/request/${r.id}`} className={btnPrimary + ' no-underline'}>
                  Sign now
                </a>
              </li>
            ))}
          </ul>
        )}
        {signed.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-h3 font-serif">Signed</h3>
            <ul className="flex flex-col gap-1">
              {signed.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline gap-3">
                  <span>
                    {r.title}, signed {r.signedAt ? formatShortDate(r.signedAt) : ''}
                  </span>
                  {r.hasPdf && (
                    <a href={signing.pdfUrl(r.id)} className={btnQuiet}>
                      Download PDF
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <form onSubmit={upload} className="flex max-w-[48ch] flex-col gap-5" noValidate>
        <h2 className="text-h2 font-serif">My documents</h2>
        <p className="text-ash text-[0.95rem] leading-relaxed">
          To be listed in the directory, the Guild needs proof of your Baptism and Confirmation, and
          any license and insurance your trade requires. Only Guild officers can see these files.
          Use a PDF or a photo, up to 4 MB.
        </p>
        <Labeled label="What is it?" error={fields.kind}>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {DOC_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Labeled>
        {EXPIRING.has(kind) && (
          <Labeled
            label="Expires on"
            hint="Optional. The date printed on the license or policy."
            error={fields.expiresOn}
          >
            <input
              type="date"
              value={expiresOn}
              onChange={(e) => setExpiresOn(e.target.value)}
              className={inputCls}
            />
          </Labeled>
        )}
        <Labeled label="File" error={fields.file}>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="font-sans"
          />
        </Labeled>
        {error && <ErrorStrip>{error}</ErrorStrip>}
        {status && <Status>{status}</Status>}
        <div>
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? 'Uploading.' : 'Upload'}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h3 className="text-h3 font-serif">Uploaded</h3>
        {list.loading && !list.data && <Loading what="your documents" />}
        {list.error && <ErrorStrip>{list.error}</ErrorStrip>}
        {list.data && list.data.documents.length === 0 && (
          <p className="text-ash">Nothing uploaded yet.</p>
        )}
        <ul className="flex flex-col gap-3">
          {(list.data?.documents ?? []).map((d) => (
            <li key={d.id} className="border-mortar flex flex-col gap-1 border-b pb-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold">{d.kindLabel}</span>
                <StatusTag status={d.status} />
              </div>
              <div className="text-ash flex flex-wrap gap-x-4 text-[0.9rem]">
                <a href={d.fileUrl} target="_blank" rel="noopener" className="underline">
                  {d.filename}
                </a>
                <span>Uploaded {formatShortDate(d.createdAt)}</span>
                {d.expiresOn && <span>Expires {formatDay(d.expiresOn)}</span>}
              </div>
              {d.note && <p className="text-[0.95rem]">Note from the Guild: {d.note}</p>}
              {d.status === 'pending' && (
                <div>
                  <button type="button" className={btnMuted} onClick={() => remove(d)}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
