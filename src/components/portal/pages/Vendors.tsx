import { useEffect, useRef, useState } from 'react';
import { users as api, type UserView, type Vendor } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import type { Session } from '@/lib/types';
import { ErrorStrip, inputCls, Loading, msg, Status } from '../ui';
import { Card, pBtn, pBtnQuiet } from '../layout';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Outside people and businesses who provide services to the Guild, visible to
 * officers and the Admin. Read only for everyone but the Admin, who adds and
 * removes vendors and sets what each one provides. Vendor status is separate
 * from officer access and board membership.
 */
export default function VendorsPage({ session }: { session: Session }) {
  const admin = session.role === 'admin' && session.siteAdmin;
  const vendors = useResource(() => api.vendors(), []);
  const accounts = useResource(() => (admin ? api.list() : Promise.resolve([])), [admin]);
  const list = vendors.data ?? [];
  const candidates = (accounts.data ?? []).filter((u) => !u.disabled && !u.vendor);

  // Removing someone takes their card off the list, so the message lives here
  // and focus moves to it (the same pattern as the Board page).
  const [notice, setNotice] = useState({ text: '', n: 0 });
  const noticeRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (notice.n) noticeRef.current?.focus();
  }, [notice.n]);
  const announce = (text: string) => setNotice((p) => ({ text, n: p.n + 1 }));

  return (
    <div className="flex flex-col gap-6">
      <p
        ref={noticeRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className={
          notice.text
            ? 'border-mortar bg-paper rounded-md border-l-4 px-4 py-3 font-sans font-semibold focus:outline-2 focus:outline-offset-2'
            : 'sr-only'
        }
      >
        {notice.text}
      </p>
      {admin && accounts.error && <ErrorStrip>{accounts.error}</ErrorStrip>}
      {admin && accounts.data && <AddVendor candidates={candidates} />}
      <Card
        title={
          vendors.data ? `${list.length} ${list.length === 1 ? 'vendor' : 'vendors'}` : 'Vendors'
        }
      >
        {vendors.error && <ErrorStrip>{vendors.error}</ErrorStrip>}
        {vendors.loading && !vendors.data && <Loading what="the vendors" />}
        {vendors.data && list.length === 0 && <p className="text-ash font-sans">No vendors yet.</p>}
        {list.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((v) => (
              <VendorCard
                key={v.id}
                v={v}
                me={v.id === session.userId}
                admin={admin}
                onGone={announce}
              />
            ))}
          </ul>
        )}
        {!admin && vendors.data && (
          <p className="text-ash mt-4 font-sans text-[0.9rem]">
            Only the Admin can change the vendor list.
          </p>
        )}
      </Card>
    </div>
  );
}

function VendorCard({
  v,
  me,
  admin,
  onGone,
}: {
  v: Vendor;
  me: boolean;
  admin: boolean;
  /** Page-level message for a change that takes this card off the list. */
  onGone: (text: string) => void;
}) {
  const [service, setService] = useState(v.vendorService);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const first = v.name.split(' ')[0];
  const promptRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    if (confirm) promptRef.current?.focus();
  }, [confirm]);

  function cancel() {
    setConfirm(false);
    requestAnimationFrame(() => opener.current?.focus());
  }

  async function saveService(e: React.FormEvent) {
    e.preventDefault();
    const s = service.trim();
    setBusy(true);
    setErr('');
    setStatus('');
    try {
      await api.update(v.id, { vendorService: s });
      if (alive.current) setStatus(s ? 'Service saved.' : 'Service cleared.');
    } catch (e2) {
      if (alive.current) setErr(msg(e2, 'Could not save that.'));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setErr('');
    try {
      await api.update(v.id, { vendor: false });
      // Stay busy: the refetch removes this card.
      onGone(`${v.name} is no longer a vendor.`);
    } catch (e2) {
      if (alive.current) {
        setErr(msg(e2, 'Could not remove them from the vendors.'));
        setBusy(false);
      }
    }
  }

  return (
    <li className="border-mortar bg-stone/40 flex min-w-0 flex-col gap-3 rounded-md border p-4 font-sans">
      <div className="flex items-start gap-3">
        <span
          className="bg-mortar/60 text-charcoal flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold"
          aria-hidden="true"
        >
          {initials(v.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-serif text-[1.25rem] leading-tight">{v.name}</span>
            {me && <span className="text-ash text-[0.85rem]">(you)</span>}
          </p>
          <p className={v.vendorService ? 'font-semibold' : 'text-ash italic'}>
            {v.vendorService || 'No service listed yet'}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.95rem]">
        <dt className="text-ash">Email</dt>
        <dd className="min-w-0 break-words">
          <a href={`mailto:${v.email}`} className="underline underline-offset-4">
            {v.email}
          </a>
        </dd>
        <dt className="text-ash">Last signed in</dt>
        <dd>{v.lastLoginAt ? formatShortDate(v.lastLoginAt) : 'Not yet'}</dd>
      </dl>

      {admin && (
        <div className="border-mortar flex flex-col gap-3 border-t pt-3">
          <form className="flex flex-col gap-1" onSubmit={saveService}>
            <label htmlFor={`vendor-service-${v.id}`} className="text-[0.9rem] font-semibold">
              Service
            </label>
            <div className="flex gap-2">
              <input
                id={`vendor-service-${v.id}`}
                value={service}
                onChange={(e) => setService(e.target.value)}
                maxLength={120}
                placeholder="e.g. Printing"
                className={`${inputCls} min-w-0 flex-1 py-1.5`}
              />
              <button
                type="submit"
                className={pBtnQuiet}
                disabled={busy || service.trim() === v.vendorService}
              >
                Save
              </button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {confirm ? (
              <div
                ref={promptRef}
                role="group"
                aria-labelledby={`vendor-confirm-${v.id}`}
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancel();
                }}
                className="flex flex-wrap items-center gap-2 focus:outline-2 focus:outline-offset-2"
              >
                <span id={`vendor-confirm-${v.id}`} className="text-[0.9rem]">
                  {me ? 'Take yourself off the vendors?' : `Take ${first} off the vendors?`} Their
                  account stays.
                </span>
                <button
                  type="button"
                  className={pBtn}
                  disabled={busy}
                  aria-busy={busy}
                  onClick={remove}
                >
                  {busy ? 'Saving…' : 'Yes, remove'}
                </button>
                <button type="button" className={pBtnQuiet} disabled={busy} onClick={cancel}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={pBtnQuiet}
                onClick={(e) => {
                  opener.current = e.currentTarget;
                  setConfirm(true);
                }}
              >
                Remove from vendors
              </button>
            )}
          </div>
        </div>
      )}
      {err && <ErrorStrip>{err}</ErrorStrip>}
      <Status>{status}</Status>
    </li>
  );
}

function AddVendor({ candidates }: { candidates: UserView[] }) {
  const [pick, setPick] = useState('');
  const [service, setService] = useState('');
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const who = candidates.find((c) => c.id === pick);
    if (!who) return;
    setBusy(true);
    setErr('');
    setStatus('');
    try {
      const s = service.trim();
      await api.update(who.id, { vendor: true, ...(s ? { vendorService: s } : {}) });
      setStatus(`${who.name} is now a vendor.`);
      setPick('');
      setService('');
    } catch (e2) {
      setErr(msg(e2, 'Could not add them as a vendor.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add a vendor">
      <form onSubmit={add} className="flex flex-col gap-3 font-sans">
        <p className="text-ash text-[0.95rem]">
          Anyone with an enabled account. Being a vendor does not change their other access.
        </p>
        <div className="grid gap-3 md:grid-cols-[2fr_2fr_auto] md:items-end">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="add-vendor" className="font-semibold">
              Account
            </label>
            <select
              id="add-vendor"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={`${inputCls} h-11 min-w-0`}
            >
              <option value="">{candidates.length ? 'Pick someone' : 'No one left to add'}</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.name !== c.email ? ` (${c.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="add-vendor-service" className="font-semibold">
              Service <span className="text-ash font-normal">(optional)</span>
            </label>
            <input
              id="add-vendor-service"
              value={service}
              onChange={(e) => setService(e.target.value)}
              maxLength={120}
              placeholder="e.g. Website, design, and photography"
              className={`${inputCls} h-11 min-w-0`}
            />
          </div>
          <button
            type="submit"
            className={`${pBtn} h-11`}
            disabled={!pick || busy}
            aria-busy={busy}
          >
            {busy ? 'Adding…' : 'Add a vendor'}
          </button>
        </div>
        {err && <ErrorStrip>{err}</ErrorStrip>}
        <Status>{status}</Status>
      </form>
    </Card>
  );
}
