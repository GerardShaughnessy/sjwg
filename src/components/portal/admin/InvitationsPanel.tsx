import { useState } from 'react';
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

export interface InvitePrefill {
  email: string;
  name: string;
  phone: string;
  memberId: string;
}

/**
 * Officers invite members; no public sign-up exists. The man sets up his own
 * account and directory entry from the link. Lives at the top of the Members tab.
 * `prefill` comes from a listed entry that has no login yet.
 */
export default function InvitationsPanel({
  prefill,
  onClearPrefill,
}: {
  prefill?: InvitePrefill | null;
  onClearPrefill?: () => void;
}) {
  const { data, loading, error } = useResource(() => api.list(), []);
  const [email, setEmail] = useState(prefill?.email ?? '');
  const [name, setName] = useState(prefill?.name ?? '');
  const [phone, setPhone] = useState(prefill?.phone ?? '');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const memberId = prefill?.memberId ?? '';
  const [status, setStatus] = useState('');
  const [link, setLink] = useState<{ url: string; name: string; phone: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function report(r: InvitationResult, what: string, who = { name: '', phone: '' }) {
    setStatus(
      r.emailed
        ? `${what} ${r.email}. The link works for seven days. You can also text it to him below.`
        : `${what} ${r.email}, but the email could not be sent (${r.mailError ?? 'mail is not set up'}). Text or copy the link below.`,
    );
    setCopied(false);
    setLink({ url: `${window.location.origin}${r.link}`, ...who });
  }
  const smsHref = (l: { url: string; name: string; phone: string }) =>
    `sms:${l.phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(
      `${l.name ? `${l.name.split(' ')[0]}, you` : 'You'} are invited to the St. Joseph the Worker Guild portal. Set up your account here (the link works for seven days): ${l.url}`,
    )}`;
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
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
      report(r, 'Invited', { name: name.trim(), phone: phone.trim() });
      setEmail('');
      setName('');
      setPhone('');
      onClearPrefill?.();
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setFormError(msg(err, 'Could not send the invitation.'));
    } finally {
      setPending(false);
    }
  }
  async function resend(id: string, who: string) {
    try {
      report(await api.resend(id), 'Re-sent to', { name: who, phone: '' });
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

  // Accepted invitations are members now; they show in the list beside this.
  const list = (data ?? []).filter((i) => i.state !== 'accepted');

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={send} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">Invite a member</h2>
        <p className="text-ash text-[0.95rem]">
          He gets a link by email, and you can text it to him too. The link lets him set a password,
          pick his trade, and start his own directory entry. It stays private until he chooses to
          list it.
        </p>
        {prefill && (
          <p className="border-brass bg-paper flex flex-wrap items-baseline justify-between gap-3 border-l-4 px-4 py-3 text-[0.95rem]">
            <span>
              Inviting <span className="font-semibold">{prefill.name}</span> to the entry already
              listed for him.
            </span>
            <button type="button" onClick={onClearPrefill} className={btnQuiet}>
              Invite someone else
            </button>
          </p>
        )}
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
        <Labeled label="Name" hint="Pre-fills his sign-up form." error={fields.name}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
        </Labeled>
        <Labeled
          label="Cell phone"
          hint="Optional. Only used to text him the link from your phone."
        >
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputCls}
            autoComplete="off"
          />
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
            Officer: everything, including events, sponsors, donor records, and members
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
          <div className="border-brass bg-paper flex flex-col gap-3 border-l-4 px-4 py-3 text-[0.95rem]">
            <p className="break-all">
              <span className="font-semibold">Invitation link:</span> <code>{link.url}</code>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={smsHref(link)} className={btnPrimary}>
                Text it{link.phone ? ` to ${link.phone}` : ''}
              </a>
              <button type="button" onClick={() => copy(link.url)} className={btnQuiet}>
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          </div>
        )}
      </form>
      <div>
        <h3 className="text-brass-ink font-sans text-[0.95rem] font-semibold">
          Waiting to accept ({list.length})
        </h3>
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
          <p className="text-ash mt-2 font-sans">Nobody is waiting. Everyone invited has joined.</p>
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
                    {i.state === 'expired'
                      ? `Expired ${formatShortDate(i.expiresAt)}`
                      : `Sent ${formatShortDate(i.createdAt)}${i.openedAt ? ', opened' : ''}, expires ${formatShortDate(i.expiresAt)}`}
                    {i.invitedBy ? ` · by ${i.invitedBy}` : ''}
                  </p>
                </div>
                <div className="flex gap-4 text-[0.95rem]">
                  <button
                    type="button"
                    onClick={() => resend(i.id, i.name ?? '')}
                    className={btnQuiet}
                  >
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
