import { useMemo, useState } from 'react';
import { docs, type MemberDoc } from '@/lib/api-docs';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import { formatDay, StatusTag } from '../member/MyDocuments';
import { btnQuiet, btnSecondary, ErrorStrip, inputCls, Loading, msg, Status } from '../ui';

type Filter = 'pending' | 'expiring' | 'all';
const DAY = 24 * 3600 * 1000;

function expiringSoon(d: MemberDoc, now = Date.now()): boolean {
  if (!d.expiresOn || d.status === 'rejected') return false;
  const t = Date.parse(`${d.expiresOn}T23:59:59Z`);
  return t - now <= 30 * DAY;
}

const CHECKS = [
  { key: 'baptism', label: 'Baptism' },
  { key: 'confirmation', label: 'Confirmation' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'license', label: 'License' },
] as const;

/**
 * Officers review every tradesman's private documents, grouped by tradesman,
 * with a checklist of what his listing needs.
 */
export default function DocumentsReview() {
  const { data, loading, error } = useResource(() => docs.all(), []);
  const [filter, setFilter] = useState<Filter>('pending');
  const [status, setStatus] = useState('');
  const [actionError, setActionError] = useState('');

  const groups = useMemo(() => {
    if (!data) return [];
    const byMember = new Map<string, MemberDoc[]>();
    for (const d of data.documents)
      byMember.set(d.memberId, [...(byMember.get(d.memberId) ?? []), d]);
    const pledged = new Set(data.pledgeSigned);
    return data.members
      .map((m) => {
        const all = byMember.get(m.id) ?? [];
        const shown = all.filter((d) =>
          filter === 'all' ? true : filter === 'pending' ? d.status === 'pending' : expiringSoon(d),
        );
        const verified = (k: string) =>
          all.some(
            (d) =>
              d.kind === k &&
              d.status === 'verified' &&
              !(d.expiresOn && Date.parse(`${d.expiresOn}T23:59:59Z`) < Date.now()),
          );
        return {
          member: m,
          all,
          shown,
          checklist: [
            { label: 'Pledge signed', ok: pledged.has(m.id) },
            ...CHECKS.map((c) => ({ label: c.label, ok: verified(c.key) })),
          ],
        };
      })
      .filter((g) =>
        filter === 'all' ? g.all.length > 0 || g.checklist[0].ok : g.shown.length > 0,
      );
  }, [data, filter]);

  async function review(d: MemberDoc, patch: Parameters<typeof docs.review>[1], what: string) {
    setActionError('');
    try {
      await docs.review(d.id, patch);
      setStatus(`${what}: ${d.kindLabel}, ${d.filename}.`);
    } catch (err) {
      setActionError(msg(err, 'Could not save that.'));
    }
  }
  async function remove(d: MemberDoc) {
    if (!window.confirm(`Delete ${d.filename} for good?`)) return;
    try {
      await docs.remove(d.id);
      setStatus(`Deleted ${d.filename}.`);
    } catch (err) {
      setActionError(msg(err, 'Could not delete that.'));
    }
  }

  return (
    <div className="flex flex-col gap-6 font-sans">
      <h2 className="text-h2 font-serif">Tradesman documents</h2>
      <p className="text-ash max-w-[65ch] text-[0.95rem]">
        Proof of Baptism and Confirmation, licenses, and insurance. These are private: only officers
        and the tradesman himself can open them. Expired documents do not count toward the
        checklist.
      </p>
      <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-2">
        {(
          [
            ['pending', 'Waiting for review'],
            ['expiring', 'Expiring within 30 days'],
            ['all', 'All'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={filter === v}
            onClick={() => setFilter(v)}
            className={`border-2 px-3 py-1.5 font-semibold ${filter === v ? 'border-charcoal bg-charcoal text-stone' : 'border-mortar'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && !data && <Loading what="documents" />}
      {error && <ErrorStrip>{error}</ErrorStrip>}
      {actionError && <ErrorStrip>{actionError}</ErrorStrip>}
      {status && <Status>{status}</Status>}
      {data && groups.length === 0 && (
        <p className="text-ash">
          {filter === 'pending'
            ? 'Nothing is waiting for review.'
            : filter === 'expiring'
              ? 'Nothing expires in the next 30 days.'
              : 'No documents yet.'}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.member.id} className="border-charcoal flex flex-col gap-4 border-t-2 pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-h3 font-serif">
              {g.member.name}{' '}
              <span className="text-ash font-sans text-[0.95rem]">{g.member.trade}</span>
            </h3>
            <ul
              className="flex flex-wrap gap-2 text-[0.85rem]"
              aria-label={`Checklist for ${g.member.name}`}
            >
              {g.checklist.map((c) => (
                <li
                  key={c.label}
                  className={`border-2 px-2 py-0.5 font-semibold ${c.ok ? 'border-charcoal bg-charcoal text-stone' : 'border-mortar text-ash'}`}
                >
                  {c.ok ? 'Yes' : 'No'}: {c.label}
                </li>
              ))}
            </ul>
          </div>
          <ul className="flex flex-col gap-4">
            {g.shown.map((d) => (
              <DocRow key={d.id} d={d} onReview={review} onRemove={remove} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function DocRow({
  d,
  onReview,
  onRemove,
}: {
  d: MemberDoc;
  onReview: (d: MemberDoc, patch: Parameters<typeof docs.review>[1], what: string) => Promise<void>;
  onRemove: (d: MemberDoc) => Promise<void>;
}) {
  const [note, setNote] = useState(d.note);
  const [expiresOn, setExpiresOn] = useState(d.expiresOn ?? '');
  const soon = expiringSoon(d);
  return (
    <li className="bg-paper border-mortar flex flex-col gap-3 border-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold">{d.kindLabel}</span>
        <StatusTag status={d.status} />
        {soon && d.expiresOn && (
          <span className="text-brick text-[0.9rem] font-semibold">
            {Date.parse(`${d.expiresOn}T23:59:59Z`) < Date.now() ? 'Expired' : 'Expires'}{' '}
            {formatDay(d.expiresOn)}
          </span>
        )}
      </div>
      <div className="text-ash flex flex-wrap gap-x-4 text-[0.9rem]">
        <a href={d.fileUrl} target="_blank" rel="noopener" className="underline">
          Open {d.filename}
        </a>
        <span>Uploaded {formatShortDate(d.createdAt)}</span>
        {d.reviewedAt && (
          <span>
            Reviewed {formatShortDate(d.reviewedAt)}
            {d.reviewedByName ? ` by ${d.reviewedByName}` : ''}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[0.9rem] font-semibold">Note (the tradesman sees this)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
            maxLength={500}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.9rem] font-semibold">Expires on</span>
          <input
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btnSecondary}
          onClick={() =>
            onReview(d, { status: 'verified', note, expiresOn: expiresOn || null }, 'Verified')
          }
        >
          Mark verified
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            if (!note.trim()) {
              window.alert('Add a note so the tradesman knows what to fix.');
              return;
            }
            void onReview(
              d,
              { status: 'rejected', note, expiresOn: expiresOn || null },
              'Not accepted',
            );
          }}
        >
          Reject
        </button>
        <button
          type="button"
          className={btnQuiet}
          onClick={() => onReview(d, { note, expiresOn: expiresOn || null }, 'Saved')}
        >
          Save note and date
        </button>
        <button type="button" className={btnQuiet} onClick={() => onRemove(d)}>
          Delete
        </button>
      </div>
    </li>
  );
}
