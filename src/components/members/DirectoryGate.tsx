import { useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { directory } from '@/lib/api-directory';
import { isEmail, required } from '@/lib/validate';
import { FormStatus, PrimaryButton, TextArea, TextInput } from '@/components/forms/fields';

type Affirmation = { id: string; text: string };

interface Props {
  heading: string;
  gateText: string[];
  first: Affirmation[];
  rest: Affirmation[];
  catholicLabel: string;
  notCatholicLabel: string;
  alignmentPrompt: string;
  pledgeUrl: string;
  /** YYYY-MM-DD in America/Chicago, from the server. */
  today: string;
}

/**
 * The directory gate. Every box is required. On success the server sets a
 * signed cookie and the page reloads into the directory.
 */
export default function DirectoryGate(p: Props) {
  const all = [...p.first, ...p.rest];
  const [affirm, setAffirm] = useState<Record<string, boolean>>({});
  const [catholic, setCatholic] = useState<'' | 'catholic' | 'not-catholic'>('');
  const [note, setNote] = useState('');
  const [v, setV] = useState({ fullName: '', signedDate: p.today, email: '' });
  const [honey, setHoney] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const set = (k: keyof typeof v, val: string) => setV((s) => ({ ...s, [k]: val }));

  function validate() {
    const e: Record<string, string> = {};
    for (const a of all) if (!affirm[a.id]) e[`affirm.${a.id}`] = 'Tick this box to continue.';
    if (!catholic) e.catholic = 'Choose the line that describes you.';
    if (catholic === 'not-catholic' && !required(note))
      e.alignmentNote = 'Tell us how your values align.';
    if (note.length > 2000) e.alignmentNote = 'Keep this under 2000 characters.';
    if (!required(v.fullName)) e.fullName = 'Your full name.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.signedDate)) e.signedDate = "Use today's date.";
    if (!isEmail(v.email)) e.email = 'That email does not look right, like name@example.com.';
    return e;
  }

  function focusFirst(e: Record<string, string>) {
    const first = Object.keys(e)[0];
    if (!first) return;
    const id = first.startsWith('affirm.') ? `dir-${first.slice(7)}` : `dir-${first}`;
    formRef.current?.querySelector<HTMLElement>(`#${id}`)?.focus();
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirst(e);
      return;
    }
    setPending(true);
    setSubmitError('');
    try {
      await directory.affirm({
        ...v,
        catholic,
        alignmentNote: catholic === 'not-catholic' ? note : '',
        affirm,
        website: honey,
      });
      window.location.assign(window.location.pathname);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        focusFirst(err.fields);
      }
      setSubmitError(err instanceof Error ? err.message : 'Could not send. Try again.');
      setPending(false);
    }
  }

  const box = (a: Affirmation) => {
    const err = errors[`affirm.${a.id}`];
    return (
      <li key={a.id} className="border-mortar border-b">
        <label htmlFor={`dir-${a.id}`} className="flex cursor-pointer items-start gap-4 px-1 py-4">
          <input
            type="checkbox"
            id={`dir-${a.id}`}
            checked={Boolean(affirm[a.id])}
            onChange={(e) => setAffirm((s) => ({ ...s, [a.id]: e.target.checked }))}
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? `dir-${a.id}-error` : undefined}
            className="accent-brick mt-1 h-5 w-5 shrink-0"
          />
          <span className="font-sans text-[1.0625rem] leading-snug">{a.text}</span>
        </label>
        {err && (
          <p
            id={`dir-${a.id}-error`}
            role="alert"
            className="text-brick -mt-2 pb-3 pl-10 font-sans text-[0.95rem] font-semibold"
          >
            {err}
          </p>
        )}
      </li>
    );
  };

  const radio = (value: 'catholic' | 'not-catholic', label: string) => {
    const rid = value === 'catholic' ? 'dir-catholic' : 'dir-catholic-no';
    return (
      <label
        htmlFor={rid}
        className={`flex cursor-pointer items-start gap-4 px-3 py-3 ${catholic === value ? 'bg-paper' : ''}`}
      >
        <input
          type="radio"
          id={rid}
          name="dir-catholic"
          value={value}
          checked={catholic === value}
          onChange={() => setCatholic(value)}
          className="accent-brick mt-1 h-5 w-5 shrink-0"
        />
        <span className="font-sans text-[1.0625rem] leading-snug">{label}</span>
      </label>
    );
  };

  return (
    <section aria-labelledby="dir-gate-heading" className="max-w-[72ch]">
      <h2 id="dir-gate-heading" className="text-h2 font-serif">
        {p.heading}
      </h2>
      {p.gateText.map((t) => (
        <p key={t.slice(0, 24)} className="mt-4 leading-relaxed">
          {t}
        </p>
      ))}
      <form ref={formRef} noValidate onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <ul className="border-mortar border-t">
          {p.first.map(box)}
          <li className="border-mortar border-b py-3">
            <fieldset
              aria-describedby={errors.catholic ? 'dir-catholic-error' : undefined}
              aria-invalid={errors.catholic ? true : undefined}
            >
              <legend className="sr-only">Your Catholic status</legend>
              {radio('catholic', p.catholicLabel)}
              {radio('not-catholic', p.notCatholicLabel)}
            </fieldset>
            {errors.catholic && (
              <p
                id="dir-catholic-error"
                role="alert"
                className="text-brick px-3 font-sans text-[0.95rem] font-semibold"
              >
                {errors.catholic}
              </p>
            )}
            {catholic === 'not-catholic' && (
              <div className="mt-3 px-3 pb-2">
                <TextArea
                  id="dir-alignmentNote"
                  label={p.alignmentPrompt}
                  value={note}
                  maxLength={2000}
                  required
                  error={errors.alignmentNote}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            )}
          </li>
          {p.rest.map(box)}
        </ul>

        <p className="font-sans">
          <a
            href={p.pledgeUrl}
            target="_blank"
            rel="noopener"
            className="decoration-brass font-semibold underline decoration-2 underline-offset-4"
          >
            View the Ethical Pledge
          </a>
          <span className="text-ash"> (opens in a new tab)</span>
        </p>

        <div className="grid gap-6 sm:grid-cols-2">
          <TextInput
            id="dir-fullName"
            label="Full name"
            autoComplete="name"
            value={v.fullName}
            error={errors.fullName}
            onChange={(e) => set('fullName', e.target.value)}
          />
          <TextInput
            id="dir-signedDate"
            label="Date"
            type="date"
            value={v.signedDate}
            error={errors.signedDate}
            onChange={(e) => set('signedDate', e.target.value)}
          />
        </div>
        <TextInput
          id="dir-email"
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={v.email}
          error={errors.email}
          onChange={(e) => set('email', e.target.value)}
        />
        <div
          className="absolute top-auto -left-[9999px] h-px w-px overflow-hidden"
          aria-hidden="true"
        >
          <label htmlFor="dir-website">Leave this empty</label>
          <input
            id="dir-website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honey}
            onChange={(e) => setHoney(e.target.value)}
          />
        </div>
        {submitError && !pending && (
          <p
            role="alert"
            className="border-brick text-brick border-l-4 px-4 py-3 font-sans font-semibold"
          >
            {submitError}
          </p>
        )}
        <div className="flex items-center gap-4">
          <PrimaryButton pending={pending} pendingLabel="Opening the directory">
            I affirm. Show the directory
          </PrimaryButton>
          {pending && <FormStatus>Sending.</FormStatus>}
        </div>
      </form>
    </section>
  );
}
