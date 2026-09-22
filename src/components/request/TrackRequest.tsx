import { useState } from 'react';
import { ApiError, track, type TrackedRequest } from '@/lib/api';
import { PrimaryButton, TextArea } from '@/components/forms/fields';
import { TK } from '@/config/site';

const STATUS: Record<TrackedRequest['status'], { label: string; detail: string }> = {
  open: { label: 'Received', detail: 'The Guild has it. Nobody has picked it up yet.' },
  claimed: {
    label: 'A member has it',
    detail: 'A Guild member took this one and will be in touch.',
  },
  referred: { label: 'Referred', detail: 'The Guild passed this to someone who can help.' },
  closed: {
    label: 'Closed',
    detail: 'This request is finished. Send a new one if something else comes up.',
  },
};

const URGENCY: Record<string, string> = {
  'can-wait': 'It can wait',
  'getting-worse': 'It is getting worse',
  'no-heat-or-water': 'No heat, no water, or not safe',
};

function when(iso: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(new Date(iso));
}

export default function TrackRequest({
  token,
  initial,
}: {
  token: string;
  initial: TrackedRequest;
}) {
  const [req, setReq] = useState(initial);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const s = STATUS[req.status];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError('Write something first.');
      return;
    }
    setError('');
    setPending(true);
    try {
      const { note: saved } = await track.addNote(token, note.trim());
      setReq({ ...req, notes: [...req.notes, saved] });
      setNote('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the note. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section aria-labelledby="status-title">
        <h2 id="status-title" className="text-h3">
          Status
        </h2>
        <p className="border-brass bg-paper mt-3 border-l-4 px-4 py-3">
          <span className="block font-serif text-[1.5rem] leading-tight">{s.label}</span>
          <span className="text-ash mt-1 block font-sans text-[0.95rem]">{s.detail}</span>
        </p>
        <p className="mt-4 font-sans text-[0.95rem] leading-relaxed">
          <span
            className="sample"
            data-tk={TK.responseCommitment.text}
            title={`Sample copy. Needed: ${TK.responseCommitment.text}`}
          >
            {TK.responseCommitment.sample}
          </span>
        </p>
        <dl className="border-mortar mt-8 grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-6 gap-y-3 border-t pt-4 font-sans text-[1rem]">
          <dt className="text-ash">Sent</dt>
          <dd>{when(req.createdAt)}</dd>
          <dt className="text-ash">Need</dt>
          <dd>{req.trade}</dd>
          <dt className="text-ash">Urgency</dt>
          <dd>{URGENCY[req.urgency] ?? req.urgency}</dd>
          <dt className="text-ash">Where</dt>
          <dd>{[req.zip, req.neighborhood].filter(Boolean).join(', ')}</dd>
          <dt className="text-ash">Situation</dt>
          <dd className="whitespace-pre-wrap">{req.description}</dd>
          {req.photos.length > 0 && (
            <>
              <dt className="text-ash">Photo</dt>
              <dd className="flex flex-wrap gap-3">
                {req.photos.map((p) => (
                  <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                    <img
                      src={p.url}
                      alt="The photo you attached"
                      className="border-mortar h-28 w-28 border object-cover"
                      loading="lazy"
                    />
                  </a>
                ))}
              </dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="notes-title">
        <h2 id="notes-title" className="text-h3">
          Notes
        </h2>
        {req.notes.length === 0 ? (
          <p className="text-ash mt-3 font-sans text-[0.95rem]">
            No notes yet. Anything a Guild member writes back shows up here, and you can add to it
            below.
          </p>
        ) : (
          <ol className="border-mortar mt-3 flex flex-col border-t">
            {req.notes.map((n) => (
              <li key={n.id} className="border-mortar border-b py-3">
                <p className="text-ash font-sans text-[0.85rem]">
                  <span className="text-charcoal font-semibold">{n.by}</span>, {when(n.at)}
                </p>
                <p className="mt-1 font-sans text-[1rem] leading-relaxed whitespace-pre-wrap">
                  {n.body}
                </p>
              </li>
            ))}
          </ol>
        )}
        {req.status !== 'closed' && (
          <form noValidate onSubmit={send} className="mt-6 flex flex-col gap-4">
            <TextArea
              id="note"
              label="Add a note"
              hint="Anything that changed, a better time to call, or a detail you forgot."
              value={note}
              error={error}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
            <div>
              <PrimaryButton pending={pending} pendingLabel="Sending">
                Send the note
              </PrimaryButton>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
