import { useState } from 'react';
import { users as api, type UserView } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import type { Session } from '@/lib/types';
import InvitationsPanel from '../admin/InvitationsPanel';
import { ErrorStrip, inputCls, Loading, msg, Status } from '../ui';
import { Badge, Card, pBtn, pBtnQuiet } from '../layout';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/**
 * Every officer, visible to all officers. The Admin also gets the controls:
 * make or remove officers, set titles, disable and enable accounts.
 */
export default function OfficersPage({ session }: { session: Session }) {
  const admin = session.siteAdmin;
  const { data, loading, error } = useResource(
    () => (admin ? api.list() : api.officers()),
    [admin],
  );
  const all = data ?? [];
  const officers = all.filter((u) => u.role === 'admin' && !u.disabled);
  const others = all.filter((u) => u.role !== 'admin' && !u.disabled);
  const disabled = all.filter((u) => u.disabled);

  return (
    <div className="flex flex-col gap-6">
      {admin && data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <AddOfficer candidates={others} />
          <DisabledAccounts list={disabled} />
        </div>
      )}
      <Card
        title={
          data ? `${officers.length} ${officers.length === 1 ? 'officer' : 'officers'}` : 'Officers'
        }
      >
        {error && <ErrorStrip>{error}</ErrorStrip>}
        {loading && !data && <Loading what="the officers" />}
        {data && officers.length === 0 && <p className="text-ash font-sans">No officers yet.</p>}
        {officers.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {officers.map((u) => (
              <Officer key={u.id} u={u} me={u.id === session.userId} admin={admin} />
            ))}
          </ul>
        )}
        {!admin && data && (
          <p className="text-ash mt-4 font-sans text-[0.9rem]">
            Only the Admin can change titles or officer access.
          </p>
        )}
      </Card>
    </div>
  );
}

function Officer({ u, me, admin }: { u: UserView; me: boolean; admin: boolean }) {
  const [title, setTitle] = useState(u.title);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'remove' | 'disable' | null>(null);
  const phone = u.member?.privatePhone ?? '';

  async function save(patch: Parameters<typeof api.update>[1], done: string) {
    setBusy(true);
    setErr('');
    setStatus('');
    try {
      await api.update(u.id, patch);
      setStatus(done);
      setConfirm(null);
    } catch (e) {
      setErr(msg(e, 'Could not save that.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border-mortar bg-stone/40 flex min-w-0 flex-col gap-3 rounded-md border p-4 font-sans">
      <div className="flex items-start gap-3">
        <span
          className="bg-mortar/60 text-charcoal flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold"
          aria-hidden="true"
        >
          {initials(u.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-serif text-[1.25rem] leading-tight">{u.name}</span>
            {me && <span className="text-ash text-[0.85rem]">(you)</span>}
            {u.siteAdmin && <Badge tone="waiting">Admin</Badge>}
          </p>
          <p className={u.title ? 'font-semibold' : 'text-ash italic'}>
            {u.title || 'No title yet'}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.95rem]">
        <dt className="text-ash">Email</dt>
        <dd className="min-w-0 break-words">
          <a href={`mailto:${u.email}`} className="underline underline-offset-4">
            {u.email}
          </a>
        </dd>
        {phone && (
          <>
            <dt className="text-ash">Phone</dt>
            <dd>
              <a
                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                className="underline underline-offset-4"
              >
                {phone}
              </a>
            </dd>
          </>
        )}
        <dt className="text-ash">Last signed in</dt>
        <dd>{u.lastLoginAt ? formatShortDate(u.lastLoginAt) : 'Not yet'}</dd>
      </dl>

      {admin && (
        <div className="border-mortar flex flex-col gap-3 border-t pt-3">
          <form
            className="flex flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              save({ title: title.trim() }, title.trim() ? `Title saved.` : 'Title cleared.');
            }}
          >
            <label htmlFor={`title-${u.id}`} className="text-[0.9rem] font-semibold">
              Title
            </label>
            <div className="flex gap-2">
              <input
                id={`title-${u.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. Secretary"
                className={`${inputCls} min-w-0 flex-1 py-1.5`}
              />
              <button
                type="submit"
                className={pBtnQuiet}
                disabled={busy || title.trim() === u.title}
              >
                Save
              </button>
            </div>
          </form>
          {!me && (
            <div className="flex flex-wrap items-center gap-2">
              {confirm ? (
                <>
                  <span className="text-[0.9rem]">
                    {confirm === 'remove'
                      ? `Make ${u.name.split(' ')[0]} a tradesman account?`
                      : `Disable ${u.name.split(' ')[0]}? They can't log in until enabled.`}
                  </span>
                  <button
                    type="button"
                    className={pBtn}
                    disabled={busy}
                    onClick={() =>
                      confirm === 'remove'
                        ? save({ role: 'member' }, `${u.name} is no longer an officer.`)
                        : save({ disabled: true }, `${u.name} is disabled.`)
                    }
                  >
                    {confirm === 'remove' ? 'Yes, remove' : 'Yes, disable'}
                  </button>
                  <button type="button" className={pBtnQuiet} onClick={() => setConfirm(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className={pBtnQuiet} onClick={() => setConfirm('remove')}>
                    Remove officer access
                  </button>
                  <button type="button" className={pBtnQuiet} onClick={() => setConfirm('disable')}>
                    Disable
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {err && <ErrorStrip>{err}</ErrorStrip>}
      <Status>{status}</Status>
    </li>
  );
}

function AddOfficer({ candidates }: { candidates: UserView[] }) {
  const [pick, setPick] = useState('');
  const [inviting, setInviting] = useState(false);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function promote(e: React.FormEvent) {
    e.preventDefault();
    const who = candidates.find((c) => c.id === pick);
    if (!who) return;
    setBusy(true);
    setErr('');
    try {
      await api.update(who.id, { role: 'admin' });
      setStatus(`${who.name} is now an officer.`);
      setPick('');
    } catch (e2) {
      setErr(msg(e2, 'Could not make them an officer.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Make someone an officer"
      action={
        <button type="button" className={pBtnQuiet} onClick={() => setInviting((v) => !v)}>
          {inviting ? 'Close' : 'Invite someone new'}
        </button>
      }
    >
      {inviting ? (
        <InvitationsPanel officerOnly />
      ) : (
        <form onSubmit={promote} className="flex flex-col gap-3 font-sans">
          <p className="text-ash text-[0.95rem]">
            Anyone who already has an account. Their tradesman entry stays linked.
          </p>
          <label htmlFor="make-officer" className="font-semibold">
            Account
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              id="make-officer"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={`${inputCls} min-w-0 flex-1`}
            >
              <option value="">
                {candidates.length ? 'Pick someone' : 'Everyone with an account is an officer'}
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.name !== c.email ? ` (${c.email})` : ''}
                </option>
              ))}
            </select>
            <button type="submit" className={pBtn} disabled={!pick || busy}>
              Make officer
            </button>
          </div>
          {err && <ErrorStrip>{err}</ErrorStrip>}
          <Status>{status}</Status>
        </form>
      )}
    </Card>
  );
}

function DisabledAccounts({ list }: { list: UserView[] }) {
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');

  async function enable(u: UserView) {
    setErr('');
    try {
      await api.update(u.id, { disabled: false });
      setStatus(`${u.name} can log in again.`);
    } catch (e) {
      setErr(msg(e, 'Could not enable that account.'));
    }
  }

  return (
    <Card title="Disabled accounts">
      {list.length === 0 ? (
        <p className="text-ash font-sans">None. Everyone with an account can log in.</p>
      ) : (
        <ul className="divide-mortar flex flex-col divide-y font-sans">
          {list.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{u.name}</span>
                <span className="text-ash text-[0.85rem] break-words">
                  {u.email} · {u.role === 'admin' ? 'Officer' : 'Tradesman'}
                </span>
              </span>
              <button type="button" className={pBtnQuiet} onClick={() => enable(u)}>
                Enable
              </button>
            </li>
          ))}
        </ul>
      )}
      {err && (
        <div className="mt-3">
          <ErrorStrip>{err}</ErrorStrip>
        </div>
      )}
      <div className="mt-2">
        <Status>{status}</Status>
      </div>
    </Card>
  );
}
