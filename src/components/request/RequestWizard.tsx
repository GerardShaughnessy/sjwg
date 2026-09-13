import { useEffect, useRef, useState } from 'react';
import type { HelpRequest, RequestAnswers, Urgency } from '@/lib/types';
import { NOT_SURE, slugify, tradeFromSlug } from '@/lib/trades';
import { hasPhoneOrEmail, isEmail, isPhone, isZip, required } from '@/lib/validate';
import { requests, requestDraft } from '@/lib/store';
import {
  Field,
  FormStatus,
  PrimaryButton,
  RadioGroup,
  SecondaryButton,
  Select,
  TextArea,
  TextInput,
} from '@/components/forms/fields';

/**
 * Six screens, one question each. Answers persist in sessionStorage so a
 * refresh mid-flow does not lose them. Nothing on this route asks for money.
 */

const STEPS = [
  'What you need',
  'The situation',
  'How urgent',
  'Where you are',
  'How to reach you',
] as const;

const EMPTY: RequestAnswers = {
  trade: '',
  tradeSlug: '',
  description: '',
  photoName: '',
  urgency: '',
  zip: '',
  neighborhood: '',
  contact: { name: '', phone: '', email: '', bestTime: '' },
};

const URGENCY: { value: Urgency; label: string; detail: string }[] = [
  {
    value: 'can-wait',
    label: 'It can wait',
    detail: 'Nothing is badly broken. A call this week or next is fine.',
  },
  {
    value: 'getting-worse',
    label: 'It is getting worse',
    detail: 'A leak, a fault, or damage that is spreading.',
  },
  {
    value: 'no-heat-or-water',
    label: 'No heat, no water, or not safe right now',
    detail: 'Someone needs to come today or tomorrow.',
  },
];

const URGENCY_LABEL = Object.fromEntries(URGENCY.map((u) => [u.value, u.label])) as Record<
  Urgency,
  string
>;

type Errors = Partial<Record<string, string>>;

type TkValue = { text: string; sample: string };

function Sample({ tk }: { tk: TkValue }) {
  return (
    <span className="sample" data-tk={tk.text} title={`Sample copy. Needed: ${tk.text}`}>
      {tk.sample}
    </span>
  );
}

interface Props {
  trades: string[];
  responseTk: TkValue;
  serviceAreaTk: TkValue;
}

export default function RequestWizard({ trades, responseTk, serviceAreaTk }: Props) {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<RequestAnswers>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<HelpRequest | null>(null);
  const [restored, setRestored] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);

  /* Restore the draft, then let ?trade= win for the first answer. */
  useEffect(() => {
    const draft = requestDraft.get();
    let next: RequestAnswers = draft
      ? { ...EMPTY, ...draft.answers, contact: { ...EMPTY.contact, ...draft.answers.contact } }
      : EMPTY;
    let nextStep = draft ? Math.min(draft.step, STEPS.length - 1) : 0;
    const q = tradeFromSlug(trades, new URLSearchParams(window.location.search).get('trade'));
    if (q) {
      next = { ...next, trade: q, tradeSlug: slugify(q) };
      nextStep = 0;
    }
    setA(next);
    setStep(nextStep);
    setRestored(true);
  }, [trades]);

  /* Persist on every change after restore. Photo bytes never leave memory. */
  useEffect(() => {
    if (restored && !done) requestDraft.set(step, { ...a, photoName: a.photoName });
  }, [a, step, restored, done]);

  /* Move focus to the step heading on every step change (not on first paint). */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: false });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step, done]);

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  const update = (patch: Partial<RequestAnswers>) => setA((prev) => ({ ...prev, ...patch }));
  const updateContact = (patch: Partial<RequestAnswers['contact']>) =>
    setA((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));

  function validate(s: number): Errors {
    const e: Errors = {};
    if (s === 0 && !a.trade) e.trade = 'Choose one. "Not sure" is a fine answer.';
    if (s === 1 && a.description.trim().length < 10)
      e.description = 'Add a little more, even one full sentence, so the right man calls you.';
    if (s === 2 && !a.urgency) e.urgency = 'Pick the one that is closest.';
    if (s === 3) {
      if (!required(a.zip) && !required(a.neighborhood))
        e.zip = 'A zip code or a neighborhood, either one.';
      else if (required(a.zip) && !isZip(a.zip)) e.zip = 'A zip code is five digits, like 63118.';
    }
    if (s === 4) {
      if (!required(a.contact.name)) e.name = 'A first name is enough.';
      if (!hasPhoneOrEmail(a.contact.phone, a.contact.email)) {
        if (!a.contact.phone.trim() && !a.contact.email.trim())
          e.phone = 'A phone number or an email, whichever you check. You do not need both.';
        else if (a.contact.phone.trim() && !isPhone(a.contact.phone))
          e.phone = 'That phone number looks short. Ten digits with area code.';
        else if (a.contact.email.trim() && !isEmail(a.contact.email))
          e.email = 'That email is missing something, like the part after @.';
      }
    }
    return e;
  }

  function focusFirstError(e: Errors) {
    const first = Object.keys(e)[0];
    const el = formRef.current?.querySelector<HTMLElement>(`#${first}, [name="${first}"]`);
    el?.focus();
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirstError(e);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submit() {
    const e = validate(4);
    setErrors(e);
    if (Object.keys(e).length) {
      focusFirstError(e);
      return;
    }
    setPending(true);
    try {
      const saved = await requests.create(a);
      requestDraft.clear();
      setDone(saved);
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    requestDraft.clear();
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setA(EMPTY);
    setErrors({});
    setDone(null);
    setStep(0);
  }

  function onPhoto(file: File | null) {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (!file) {
      setPhotoUrl(null);
      update({ photoName: '' });
      return;
    }
    setPhotoUrl(URL.createObjectURL(file));
    update({ photoName: file.name });
  }

  if (!restored) return <p className="text-ash font-sans">Loading the form.</p>;

  if (done) {
    return (
      <section aria-labelledby="done-title" className="max-w-[64ch]">
        <h2 id="done-title" ref={headingRef} tabIndex={-1} className="text-h2 outline-none">
          Your request is in.
        </h2>
        <p className="mt-4 font-sans text-[1.0625rem] leading-relaxed">
          Your reference number. Write it down or take a screenshot.
        </p>
        <p className="border-brass bg-paper mt-2 border-l-4 px-4 py-3 font-serif text-[2rem] leading-none tracking-wide">
          {done.ref}
        </p>

        <h3 className="text-h3 mt-10">What happens next</h3>
        <p className="mt-3 leading-relaxed">
          <Sample tk={responseTk} />
        </p>
        <p className="mt-3 leading-relaxed">
          If you need to reach the Guild about this request, give the reference number.{' '}
          <a href="/contact" className="font-semibold">
            Contact the Guild
          </a>
          .
        </p>

        <h3 className="text-h3 mt-10">What you told us</h3>
        <dl className="border-mortar mt-3 grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-3 border-t pt-4 font-sans text-[1rem]">
          <dt className="text-ash">Need</dt>
          <dd>{done.trade}</dd>
          <dt className="text-ash">Situation</dt>
          <dd className="whitespace-pre-wrap">{done.description}</dd>
          {done.photoName && (
            <>
              <dt className="text-ash">Photo</dt>
              <dd>{done.photoName}</dd>
            </>
          )}
          <dt className="text-ash">Urgency</dt>
          <dd>{URGENCY_LABEL[done.urgency]}</dd>
          <dt className="text-ash">Where</dt>
          <dd>{[done.zip, done.neighborhood].filter(Boolean).join(', ')}</dd>
          <dt className="text-ash">Reach you</dt>
          <dd>
            {done.contact.name}
            {done.contact.phone ? `, ${done.contact.phone}` : ''}
            {done.contact.email ? `, ${done.contact.email}` : ''}
            {done.contact.bestTime ? `. Best time: ${done.contact.bestTime}.` : ''}
          </dd>
        </dl>

        <div className="mt-10 flex flex-wrap gap-4">
          <SecondaryButton onClick={startOver}>Send another request</SecondaryButton>
          <a
            href="/"
            className="decoration-brass inline-flex min-h-[3.25rem] items-center font-sans font-medium underline decoration-2 underline-offset-4"
          >
            Back to the home page
          </a>
        </div>
      </section>
    );
  }

  const bestTimes = ['Mornings', 'Afternoons', 'Evenings', 'Any time'];

  return (
    <form
      ref={formRef}
      noValidate
      className="max-w-[64ch]"
      onSubmit={(e) => {
        e.preventDefault();
        step === STEPS.length - 1 ? submit() : next();
      }}
    >
      <ol
        className="text-ash flex flex-wrap gap-x-1 gap-y-2 font-sans text-[0.9rem]"
        aria-label="Progress"
      >
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className="flex items-center gap-1"
          >
            <span
              className={`inline-block h-2 w-8 ${i < step ? 'bg-charcoal' : i === step ? 'bg-brick' : 'bg-mortar'}`}
              aria-hidden="true"
            />
            <span className="sr-only">
              {i < step ? 'Done: ' : i === step ? 'Current: ' : ''}
              {label}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-ash mt-2 font-sans text-[0.95rem]">
        Step {step + 1} of {STEPS.length}
      </p>

      <h2 ref={headingRef} tabIndex={-1} className="text-h2 mt-4 outline-none">
        {step === 0 && 'What do you need help with?'}
        {step === 1 && 'What is going on?'}
        {step === 2 && 'How urgent is it?'}
        {step === 3 && 'Where are you?'}
        {step === 4 && 'How should we reach you?'}
      </h2>

      <div className="mt-8 flex flex-col gap-8">
        {step === 0 && (
          <RadioGroup
            name="trade"
            legend="Pick the closest one"
            hint="Not sure is fine. Describe the problem on the next screen and the Guild will figure out who should call."
            error={errors.trade}
            value={a.trade}
            onChange={(v) => update({ trade: v, tradeSlug: slugify(v) })}
            options={[
              ...trades.map((t) => ({ value: t, label: t })),
              {
                value: NOT_SURE,
                label: NOT_SURE,
                detail: 'Someone will read your description and pick.',
              },
            ]}
          />
        )}

        {step === 1 && (
          <>
            <TextArea
              id="description"
              label="Tell us what is happening, in your own words"
              hint="What is broken, how long it has been going on, and anything you have already tried. Plain language is best."
              error={errors.description}
              value={a.description}
              onChange={(e) => update({ description: e.target.value })}
              autoComplete="off"
              autoFocus
            />
            <Field
              id="photo"
              label="A photo of the problem"
              optional
              hint="Helps the right man come prepared. Previewed on your device only in this version."
            >
              <input
                id="photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="file:border-charcoal file:bg-paper block w-full font-sans text-[1rem] file:mr-4 file:border-2 file:px-4 file:py-2.5 file:font-sans file:font-semibold"
                onChange={(e) => onPhoto(e.target.files?.[0] ?? null)}
              />
              {photoUrl && (
                <div className="mt-2 flex items-center gap-4">
                  <img
                    src={photoUrl}
                    alt={`Preview of ${a.photoName}`}
                    className="border-mortar h-24 w-24 border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onPhoto(null)}
                    className="decoration-brass font-sans font-medium underline decoration-2 underline-offset-4"
                  >
                    Remove photo
                  </button>
                </div>
              )}
              {!photoUrl && a.photoName && (
                <p className="text-ash font-sans text-[0.95rem]">
                  You attached {a.photoName} before the page reloaded. Attach it again if you still
                  want to send it.
                </p>
              )}
            </Field>
          </>
        )}

        {step === 2 && (
          <RadioGroup
            name="urgency"
            legend="Pick the one that is closest"
            error={errors.urgency}
            value={a.urgency}
            onChange={(v) => update({ urgency: v as Urgency })}
            options={URGENCY}
          />
        )}

        {step === 3 && (
          <>
            <TextInput
              id="zip"
              label="Zip code"
              hint="Five digits. Or skip it and give the neighborhood below."
              error={errors.zip}
              value={a.zip}
              onChange={(e) => update({ zip: e.target.value })}
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              autoFocus
            />
            <TextInput
              id="neighborhood"
              label="Neighborhood or town"
              optional
              value={a.neighborhood}
              onChange={(e) => update({ neighborhood: e.target.value })}
              autoComplete="address-level2"
            />
            <p className="text-ash font-sans text-[0.95rem]">
              <Sample tk={serviceAreaTk} />
            </p>
          </>
        )}

        {step === 4 && (
          <>
            <TextInput
              id="name"
              label="Your name"
              error={errors.name}
              value={a.contact.name}
              onChange={(e) => updateContact({ name: e.target.value })}
              autoComplete="name"
              autoFocus
            />
            <p className="text-ash font-sans text-[0.95rem] leading-snug">
              A phone number or an email, whichever you check. You do not need both.
            </p>
            <TextInput
              id="phone"
              label="Phone"
              error={errors.phone}
              value={a.contact.phone}
              onChange={(e) => updateContact({ phone: e.target.value })}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
            <TextInput
              id="email"
              label="Email"
              error={errors.email}
              value={a.contact.email}
              onChange={(e) => updateContact({ email: e.target.value })}
              type="email"
              inputMode="email"
              autoComplete="email"
            />
            <Select
              id="bestTime"
              label="Best time to call"
              optional
              value={a.contact.bestTime}
              onChange={(e) => updateContact({ bestTime: e.target.value })}
            >
              <option value="">Any time</option>
              {bestTimes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {step > 0 && (
          <SecondaryButton onClick={back} disabled={pending}>
            Back
          </SecondaryButton>
        )}
        <PrimaryButton pending={pending} pendingLabel="Sending your request">
          {step === STEPS.length - 1 ? 'Send request' : 'Continue'}
        </PrimaryButton>
        {pending && <FormStatus>Sending your request to the Guild.</FormStatus>}
      </div>
      {step === 0 && a.trade && (
        <p className="sr-only" aria-live="polite">
          {a.trade} selected.
        </p>
      )}
      <p className="text-ash mt-8 font-sans text-[0.9rem]">
        No account needed. Your answers stay on this device until you send them.
      </p>
    </form>
  );
}
