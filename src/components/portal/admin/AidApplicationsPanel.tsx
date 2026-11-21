import { useEffect, useState } from 'react';
import { aid as api, type AidDetail } from '@/lib/api-aid';
import { useResource } from '@/lib/hooks';
import {
  AID_STATUS_LABEL,
  AID_STATUSES,
  AID_URGENCY_LABEL,
  APPLICANT_TYPE_LABEL,
  answerRows,
  centsToDollars,
  type AidStatus,
} from '@/lib/aid';
import { btnPrimary, btnQuiet, ErrorStrip, inputCls, Labeled, Loading, msg, Status } from '../ui';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtSize = (n: number) =>
  n > 1024 * 1024
    ? `${(n / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(n / 1024))} KB`;
const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** Request Help applications: list, read every answer and document, record a decision. */
export default function AidApplicationsPanel() {
  const [filter, setFilter] = useState<AidStatus | ''>('');
  const [openId, setOpenId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('aid');
  });
  const { data, loading, error } = useResource(() => api.list(filter), [filter]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
      <div className="flex flex-col gap-4 font-sans">
        <h2 className="text-h2 font-serif">Requests for help</h2>
        <p className="text-ash text-[0.95rem]">
          Applications from the Request Help page, newest first. Files and answers are private to
          officers.
        </p>
        <Labeled label="Show">
          <select
            className={inputCls}
            value={filter}
            onChange={(e) => setFilter(e.target.value as AidStatus | '')}
          >
            <option value="">All</option>
            {AID_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AID_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Labeled>
        {error && <ErrorStrip>{error}</ErrorStrip>}
        {loading && !data && <Loading what="applications" />}
        {data && data.length === 0 && (
          <p className="text-ash">
            No applications{filter ? ` marked ${AID_STATUS_LABEL[filter].toLowerCase()}` : ''}.
          </p>
        )}
        {data && data.length > 0 && (
          <ul className="border-mortar border-t">
            {data.map((a) => {
              const active = a.id === openId;
              return (
                <li key={a.id} className="border-mortar border-b">
                  <button
                    type="button"
                    onClick={() => setOpenId(a.id)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full flex-col gap-1 px-3 py-3 text-left ${active ? 'bg-paper' : 'hover:bg-paper/60'}`}
                  >
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{a.orgName || a.contactName}</span>
                      <span className="text-ash text-[0.9rem]">{fmtDate(a.createdAt)}</span>
                    </span>
                    <span className="text-ash text-[0.9rem]">
                      {a.ref} · {APPLICANT_TYPE_LABEL[a.applicantType] ?? a.applicantType}
                    </span>
                    <span className="flex flex-wrap gap-x-4 text-[0.9rem]">
                      <span className="font-semibold">
                        {AID_STATUS_LABEL[a.status] ?? a.status}
                      </span>
                      <span className={a.urgency === 'emergency' ? 'text-brick font-semibold' : ''}>
                        {AID_URGENCY_LABEL[a.urgency] ?? a.urgency}
                      </span>
                      {a.documentCount > 0 && (
                        <span>
                          {a.documentCount} file{a.documentCount === 1 ? '' : 's'}
                        </span>
                      )}
                      {a.awardCents != null && <span>{fmtMoney(a.awardCents)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        {openId ? (
          <Detail key={openId} id={openId} onClose={() => setOpenId(null)} />
        ) : (
          <p className="text-ash font-sans">Choose an application to read it.</p>
        )}
      </div>
    </div>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: app, loading, error } = useResource(() => api.get(id), [id]);
  if (error) return <ErrorStrip>{error}</ErrorStrip>;
  if (loading && !app) return <Loading what="the application" />;
  if (!app) return null;
  const rows = answerRows(app.answers);
  return (
    <article className="flex flex-col gap-6 font-sans" aria-labelledby="aid-detail-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 id="aid-detail-title" className="text-h3 font-serif">
            {app.orgName || app.contactName}
          </h3>
          <p className="text-ash mt-1 text-[0.95rem]">
            {app.ref} · received {fmtDate(app.createdAt)}
            {!app.notifiedAt && ' · officer email did not send'}
          </p>
        </div>
        <button type="button" className={btnQuiet} onClick={onClose}>
          Close
        </button>
      </div>
      <p className="flex flex-wrap gap-x-6 gap-y-1">
        <a
          href={`mailto:${app.email}?subject=${encodeURIComponent(`Your request for help, ${app.ref}`)}`}
          className="font-semibold"
        >
          {app.email}
        </a>
        {app.phone && (
          <a href={`tel:${app.phone.replace(/[^\d+]/g, '')}`} className="font-semibold">
            {app.phone}
          </a>
        )}
      </p>
      <dl className="border-mortar border-t">
        {rows.map((r) => (
          <div
            key={r.label}
            className="border-mortar grid gap-1 border-b py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-6"
          >
            <dt className="text-ash text-[0.95rem]">{r.label}</dt>
            <dd className="leading-relaxed whitespace-pre-line">{r.value}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="aid-docs-title">
        <h4 id="aid-docs-title" className="font-semibold">
          Documents
        </h4>
        {app.documents.length === 0 ? (
          <p className="text-ash mt-1">None sent.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {app.documents.map((d) => (
              <li key={d.id}>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener"
                  className="decoration-brass font-medium underline decoration-2 underline-offset-4"
                >
                  {d.filename}
                </a>{' '}
                <span className="text-ash text-[0.9rem]">({fmtSize(d.byteSize)})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Decision app={app} />
    </article>
  );
}

function Decision({ app }: { app: AidDetail }) {
  const [status, setStatus] = useState<AidStatus>(app.status);
  const [award, setAward] = useState(centsToDollars(app.awardCents));
  const [note, setNote] = useState(app.decisionNote);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setStatus(app.status);
    setAward(centsToDollars(app.awardCents));
    setNote(app.decisionNote);
  }, [app.id, app.status, app.awardCents, app.decisionNote]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setFields({});
    setFormError('');
    setSaved('');
    try {
      await api.decide(app.id, { status, award, decisionNote: note });
      setSaved('Saved.');
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setFormError(msg(err, 'Could not save.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="border-brass bg-paper flex flex-col gap-4 border-t-4 p-5">
      <h4 className="font-semibold">Decision</h4>
      {app.decidedBy && app.decidedAt && (
        <p className="text-ash text-[0.95rem]">
          {AID_STATUS_LABEL[app.status]} by {app.decidedBy} on {fmtDate(app.decidedAt)}.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Labeled label="Status" error={fields.status}>
          <select
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as AidStatus)}
          >
            {AID_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AID_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Award, in dollars" hint="Leave blank if none." error={fields.award}>
          <input
            className={inputCls}
            inputMode="decimal"
            placeholder="0"
            value={award}
            onChange={(e) => setAward(e.target.value)}
          />
        </Labeled>
      </div>
      <Labeled
        label="Decision note"
        hint="For officers. What was decided and why, who is doing the work."
        error={fields.decisionNote}
      >
        <textarea
          className={`${inputCls} min-h-[7rem]`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Labeled>
      {formError && <ErrorStrip>{formError}</ErrorStrip>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? 'Saving' : 'Save decision'}
        </button>
        <Status>{saved}</Status>
      </div>
      <p className="text-ash text-[0.9rem]">
        Saving does not email the applicant. Let them know yourself.
      </p>
    </form>
  );
}
