import { useState } from 'react';
import type { Member } from '@/lib/types';
import { invitations as api, type InvitationResult } from '@/lib/api';
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

/** Officers invite members. No public sign-up exists. */
export default function InvitationsPanel({ members }: { members: Member[] }) {
  const { data, loading, error } = useResource(() => api.list(), []);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [memberId, setMemberId] = useState('');
  const [status, setStatus] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function report(r: InvitationResult, what: string) {
    const origin = window.location.origin;
    if (r.emailed) {
      setStatus(`${what} ${r.email}. The link works for seven days.`);
      setLink(null);
    } else {
      setStatus(
        `${what} ${r.email}, but the email could not be sent (${r.mailError ?? 'mail is not set up'}). Copy the link and send it yourself.`,
      );
      setLink(`${origin}${r.link}`);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFields({});
    setPending(true);
    try {
      const r = await api.create({
        email: email.trim(),
        name: name.trim(),
        role,
        memberId: memberId || null,
      });
      report(r, 'Invited');
      setEmail('');
      setName('');
      setMemberId('');
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setFormError(msg(err, 'Could not send the invitation.'));
    } finally {
      setPending(false);
    }
  }
  async function resend(id: string) {
    try {
      report(await api.resend(id), 'Re-sent to');
    } catch (err) {
      setFormError(msg(err, 'Could not re-send.'));
    }
  }
  async function revoke(id: string, who: string) {
    try {
      await api.revoke(id);
      setStatus(`Cancelled the invitation for ${who}.`);
    } catch (err) {
      setFormError(msg(err, 'Could not cancel that.'));
    }
  }

  const list = data ?? [];
  const linked = new Set(list.filter((i) => i.state !== 'expired').map((i) => i.memberId));

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <form onSubmit={send} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">Invite a member</h2>
        <p className="text-ash text-[0.95rem]">
          They get an email with a link to set a password. Link the invitation to a directory entry
          so he can edit it and claim jobs.
        </p>
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
        <Labeled label="Name" hint="Optional. Pre-fills the sign-up form." error={fields.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
        </Labeled>
        <Labeled
          label="Directory entry"
          hint="Which listing is his. Leave blank for an officer who is not listed."
        >
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className={inputCls}
          >
            <option value="">None</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.trade}){linked.has(m.id) ? ', already invited' : ''}
              </option>
            ))}
          </select>
        </Labeled>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold">Role</legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              className="accent-brick h-5 w-5"
              checked={role === 'member'}
              onChange={() => setRole('member')}
            />
            Member: job board, calendar, his own entry, blog drafts
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              className="accent-brick h-5 w-5"
              checked={role === 'admin'}
              onChange={() => setRole('admin')}
            />
            Officer: everything, including events, sponsors, donor records, and invitations
          </label>
        </fieldset>
        {formError && <ErrorStrip>{formError}</ErrorStrip>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? 'Sending' : 'Send the invitation'}
          </button>
          <Status>{status}</Status>
        </div>
        {link && (
          <p className="border-brass bg-paper border-l-4 px-4 py-3 text-[0.95rem] break-all">
            <span className="font-semibold">Invitation link:</span> <code>{link}</code>
          </p>
        )}
      </form>
      <div>
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">Invitations</h3>
        {error && (
          <div className="mt-2">
            <ErrorStrip>{error}</ErrorStrip>
          </div>
        )}
        {loading && !data && (
          <div className="mt-2">
            <Loading what="invitations" />
          </div>
        )}
        {data && list.length === 0 && (
          <p className="text-ash mt-2 font-sans">No invitations yet.</p>
        )}
        {list.length > 0 && (
          <ul className="border-mortar mt-2 border-t font-sans">
            {list.map((i) => (
              <li
                key={i.id}
                className="border-mortar flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <div>
                  <p>
                    <span className="font-semibold">{i.name || i.email}</span>
                    {i.name && <span className="text-ash"> {i.email}</span>}
                    <span className="text-ash"> · {i.role === 'admin' ? 'officer' : 'member'}</span>
                    {i.memberName && <span className="text-ash"> · {i.memberName}</span>}
                  </p>
                  <p className="text-ash text-[0.85rem]">
                    {i.state === 'accepted'
                      ? `Accepted ${formatShortDate(i.acceptedAt!)}`
                      : i.state === 'expired'
                        ? `Expired ${formatShortDate(i.expiresAt)}`
                        : `Sent ${formatShortDate(i.createdAt)}${i.openedAt ? ', opened' : ''}, expires ${formatShortDate(i.expiresAt)}`}
                    {i.invitedBy ? ` · by ${i.invitedBy}` : ''}
                  </p>
                </div>
                {i.state !== 'accepted' && (
                  <div className="flex gap-4 text-[0.95rem]">
                    <button type="button" onClick={() => resend(i.id)} className={btnQuiet}>
                      Re-send
                    </button>
                    <button
                      type="button"
                      onClick={() => revoke(i.id, i.name || i.email)}
                      className={btnMuted}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
