import { useState } from 'react';
import { announcements } from '@/lib/api';
import { btnPrimary, ErrorStrip, inputCls, Labeled, msg, Status } from '../ui';

/** One message to every member with an account. */
export default function AnnouncementsPanel() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setPending(true);
    setError('');
    setFields({});
    try {
      const r = await announcements.send({ subject: subject.trim(), body: body.trim() });
      setStatus(
        `Sent to ${r.sent} of ${r.recipients} members.${r.failed.length ? ` Could not reach ${r.failed.length}: ${r.failed.slice(0, 3).join('; ')}` : ''}`,
      );
      if (r.sent > 0) {
        setSubject('');
        setBody('');
      }
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setError(msg(err, 'Could not send.'));
    } finally {
      setPending(false);
      setConfirm(false);
    }
  }

  return (
    <form onSubmit={send} className="flex max-w-[48rem] flex-col gap-5 font-sans">
      <h2 className="text-h2 font-serif">Email the members</h2>
      <p className="text-ash text-[0.95rem]">
        Goes to every member who has a portal login, from the Guild's address, with your name at the
        bottom. Plain text; blank lines separate paragraphs. Use it for meeting changes, work days,
        and news. It is not for the public.
      </p>
      <Labeled label="Subject" error={fields.subject}>
        <input
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setConfirm(false);
          }}
          className={inputCls}
          maxLength={150}
        />
      </Labeled>
      <Labeled label="Message" error={fields.body}>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setConfirm(false);
          }}
          rows={10}
          className={inputCls}
        />
      </Labeled>
      {error && <ErrorStrip>{error}</ErrorStrip>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending || !subject.trim() || !body.trim()}
          className={btnPrimary}
        >
          {pending ? 'Sending' : confirm ? 'Yes, send it to everyone' : 'Send to all members'}
        </button>
        {confirm && !pending && (
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="decoration-brass font-medium underline decoration-2 underline-offset-4"
          >
            Not yet
          </button>
        )}
        <Status>{status}</Status>
      </div>
    </form>
  );
}
