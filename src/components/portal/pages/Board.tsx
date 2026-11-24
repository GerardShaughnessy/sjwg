import { useEffect, useRef, useState } from 'react';
import { users as api, type BoardMember, type UserView } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import type { Session } from '@/lib/types';
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
 * The board of directors, visible to officers and directors. Read only for
 * everyone but the Admin, who adds and removes directors and sets board titles.
 * Board membership is separate from officer access.
 */
export default function BoardPage({ session }: { session: Session }) {
  const admin = session.role === 'admin' && session.siteAdmin;
  const board = useResource(() => api.board(), []);
  const accounts = useResource(() => (admin ? api.list() : Promise.resolve([])), [admin]);
  const directors = board.data ?? [];
  const candidates = (accounts.data ?? []).filter((u) => !u.disabled && !u.director);

  // Removing someone takes their card off the list, so the message lives here
  // and focus moves to it (the same pattern as the Officers page).
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
      {admin && accounts.data && <AddDirector candidates={candidates} />}
      <Card
        title={
          board.data
            ? `${directors.length} ${directors.length === 1 ? 'director' : 'directors'}`
            : 'Directors'
        }
      >
        {board.error && <ErrorStrip>{board.error}</ErrorStrip>}
        {board.loading && !board.data && <Loading what="the board" />}
        {board.data && directors.length === 0 && (
          <p className="text-ash font-sans">No directors yet.</p>
        )}
        {directors.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {directors.map((d) => (
              <Director
                key={d.id}
                d={d}
                me={d.id === session.userId}
                admin={admin}
                onGone={announce}
              />
            ))}
          </ul>
        )}
        {!admin && board.data && (
          <p className="text-ash mt-4 font-sans text-[0.9rem]">
            Only the Admin can change the board.
          </p>
        )}
      </Card>
    </div>
  );
}

function Director({
  d,
  me,
  admin,
  onGone,
}: {
  d: BoardMember;
  me: boolean;
  admin: boolean;
  /** Page-level message for a change that takes this card off the list. */
  onGone: (text: string) => void;
}) {
  const [title, setTitle] = useState(d.boardTitle);
  const [status, setStatus] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const first = d.name.split(' ')[0];
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

  async function saveTitle(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    setBusy(true);
    setErr('');
    setStatus('');
    try {
      await api.update(d.id, { boardTitle: t });
      if (alive.current) setStatus(t ? 'Board title saved.' : 'Board title cleared.');
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
      await api.update(d.id, { director: false });
      onGone(`${d.name} is no longer on the board.`);
    } catch (e2) {
      if (alive.current) setErr(msg(e2, 'Could not remove them from the board.'));
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <li className="border-mortar bg-stone/40 flex min-w-0 flex-col gap-3 rounded-md border p-4 font-sans">
      <div className="flex items-start gap-3">
        <span
          className="bg-mortar/60 text-charcoal flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold"
          aria-hidden="true"
        >
          {initials(d.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-serif text-[1.25rem] leading-tight">{d.name}</span>
            {me && <span className="text-ash text-[0.85rem]">(you)</span>}
          </p>
          <p className={d.boardTitle ? 'font-semibold' : 'text-ash italic'}>
            {d.boardTitle || 'No board title yet'}
          </p>
          {d.officer && (
            <p className="mt-1">
              <Badge tone="neutral">
                Also an officer{d.officerTitle ? `: ${d.officerTitle}` : ''}
              </Badge>
            </p>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.95rem]">
        <dt className="text-ash">Email</dt>
        <dd className="min-w-0 break-words">
          <a href={`mailto:${d.email}`} className="underline underline-offset-4">
            {d.email}
          </a>
        </dd>
        {d.phone && (
          <>
            <dt className="text-ash">Phone</dt>
            <dd>
              <a
                href={`tel:${d.phone.replace(/[^\d+]/g, '')}`}
                className="underline underline-offset-4"
              >
                {d.phone}
              </a>
            </dd>
          </>
        )}
        <dt className="text-ash">Last signed in</dt>
        <dd>{d.lastLoginAt ? formatShortDate(d.lastLoginAt) : 'Not yet'}</dd>
      </dl>

      {admin && (
        <div className="border-mortar flex flex-col gap-3 border-t pt-3">
          <form className="flex flex-col gap-1" onSubmit={saveTitle}>
            <label htmlFor={`board-title-${d.id}`} className="text-[0.9rem] font-semibold">
              Board title
            </label>
            <div className="flex gap-2">
              <input
                id={`board-title-${d.id}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="e.g. Chair"
                className={`${inputCls} min-w-0 flex-1 py-1.5`}
              />
              <button
                type="submit"
                className={pBtnQuiet}
                disabled={busy || title.trim() === d.boardTitle}
              >
                Save
              </button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            {confirm ? (
              <div
                ref={promptRef}
                role="alertdialog"
                aria-labelledby={`board-confirm-${d.id}`}
                tabIndex={-1}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancel();
                }}
                className="flex flex-wrap items-center gap-2 focus:outline-2 focus:outline-offset-2"
              >
                <span id={`board-confirm-${d.id}`} className="text-[0.9rem]">
                  {me ? 'Take yourself off the board?' : `Take ${first} off the board?`}
                  {d.officer ? ' Officer access stays.' : ''}
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
                Remove from board
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

function AddDirector({ candidates }: { candidates: UserView[] }) {
  const [pick, setPick] = useState('');
  const [title, setTitle] = useState('');
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
      const t = title.trim();
      await api.update(who.id, { director: true, ...(t ? { boardTitle: t } : {}) });
      setStatus(`${who.name} is now on the board.`);
      setPick('');
      setTitle('');
    } catch (e2) {
      setErr(msg(e2, 'Could not add them to the board.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Add to the board">
      <form onSubmit={add} className="flex flex-col gap-3 font-sans">
        <p className="text-ash text-[0.95rem]">
          Anyone with an enabled account. They do not need to be an officer.
        </p>
        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="add-director" className="font-semibold">
              Account
            </label>
            <select
              id="add-director"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className={`${inputCls} min-w-0`}
            >
              <option value="">
                {candidates.length ? 'Pick someone' : 'Everyone with an account is on the board'}
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.name !== c.email ? ` (${c.email})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="add-director-title" className="font-semibold">
              Board title <span className="text-ash font-normal">(optional)</span>
            </label>
            <input
              id="add-director-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Treasurer"
              className={`${inputCls} min-w-0`}
            />
          </div>
          <button type="submit" className={pBtn} disabled={!pick || busy} aria-busy={busy}>
            {busy ? 'Adding…' : 'Add to the board'}
          </button>
        </div>
        {err && <ErrorStrip>{err}</ErrorStrip>}
        <Status>{status}</Status>
      </form>
    </Card>
  );
}
