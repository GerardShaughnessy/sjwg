import { useEffect, useRef, useState } from 'react';
import { ApiError, rsvp, type RsvpStatus } from '@/lib/api';
import { isEmail, isPhone, required } from '@/lib/validate';
import { FormStatus, PrimaryButton, TextInput } from './fields';

/**
 * Christmas party RSVP: Yes or No, no Maybe. A Yes gives the number of adults
 * and children; the party closes when the head count reaches capacity.
 * Answering again with the same email replaces the earlier answer.
 */
export default function RsvpForm() {
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [v, setV] = useState({ name: '', email: '', phone: '', adults: '1', children: '0' });
  const [attending, setAttending] = useState<'' | 'yes' | 'no'>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState<'' | 'yes' | 'no'>('');
  const [honey, setHoney] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    rsvp
      .status()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));
  const total = (Number(v.adults) || 0) + (Number(v.children) || 0);

  function validate() {
    const e: Record<string, string> = {};
    if (!required(v.name)) e.name = 'Tell us your name.';
    if (!isEmail(v.email)) e.email = 'That email does not look right, like name@example.com.';
    if (v.phone.trim() && !isPhone(v.phone)) e.phone = 'Ten digits with area code.';
    if (!attending) e.attending = 'Yes or no?';
    if (attending === 'yes' && total < 1) e.adults = 'How many are coming?';
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`#rsvp-${first}`)?.focus();
      return;
    }
    setPending(true);
    setSubmitError('');
    try {
      const s = await rsvp.submit({
        ...v,
        attending,
        adults: attending === 'yes' ? Number(v.adults) || 0 : 0,
        children: attending === 'yes' ? Number(v.children) || 0 : 0,
        website: honey,
      });
      setStatus(s);
      setDone(attending);
      setTimeout(() => doneRef.current?.focus(), 0);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      setSubmitError(err instanceof Error ? err.message : 'Could not send. Try again.');
      rsvp
        .status()
        .then(setStatus)
        .catch(() => {});
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rsvp-done" role="status">
        <h3 ref={doneRef} tabIndex={-1} className="text-h3 outline-none">
          {done === 'yes' ? 'Wonderful. See you after Mass!' : 'Thank you for letting us know.'}
        </h3>
        <p className="mt-3 leading-relaxed">
          {done === 'yes'
            ? `We have you down for ${total} ${total === 1 ? 'guest' : 'guests'}. If your plans change, RSVP again with the same email and we'll update it.`
            : 'We will miss you. If your plans change, RSVP again with the same email.'}
        </p>
      </div>
    );
  }

  if (status?.closed && Date.now() > Date.parse('2026-12-21T06:00:00Z')) {
    return (
      <div role="status">
        <h3 className="text-h3">Thank you for celebrating with us</h3>
        <p className="mt-3 leading-relaxed">Merry Christmas from the Guild. See you next year.</p>
      </div>
    );
  }

  if (status?.closed) {
    return (
      <div role="status">
        <h3 className="text-h3">RSVPs are closed</h3>
        <p className="mt-3 leading-relaxed">
          The party is full. To join the waiting list, email{' '}
          <a href="mailto:hello@sjwg.org">hello@sjwg.org</a> or call{' '}
          <a href="tel:+16362887002">(636) 288-7002</a>.
        </p>
      </div>
    );
  }

  const choice = (val: 'yes' | 'no', label: string) => (
    <button
      type="button"
      id={val === 'yes' ? 'rsvp-attending' : undefined}
      aria-pressed={attending === val}
      onClick={() => setAttending(val)}
      className={`min-h-[3.25rem] flex-1 border-2 px-5 py-3 font-sans text-[1.0625rem] font-semibold ${
        attending === val
          ? 'text-brass-glow border-[#2F3B2A] bg-[#2F3B2A]'
          : 'border-charcoal bg-paper hover:bg-stone'
      }`}
    >
      {label}
    </button>
  );

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
      {status && (
        <p className="text-ash font-sans text-[0.95rem]">
          {status.left} of {status.capacity} spots left
        </p>
      )}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-sans text-[1.0625rem] font-semibold">Will you join us?</legend>
        <div className="mt-1 flex gap-3">
          {choice('yes', 'Yes, we’ll be there')}
          {choice('no', 'Sorry, can’t make it')}
        </div>
        {errors.attending && (
          <p className="text-brick font-sans text-[0.95rem] font-semibold" role="alert">
            {errors.attending}
          </p>
        )}
      </fieldset>
      <TextInput
        id="rsvp-name"
        label="Name"
        autoComplete="name"
        value={v.name}
        error={errors.name}
        onChange={(e) => set('name', e.target.value)}
      />
      <TextInput
        id="rsvp-email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={v.email}
        error={errors.email}
        onChange={(e) => set('email', e.target.value)}
      />
      <TextInput
        id="rsvp-phone"
        label="Phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        optional
        value={v.phone}
        error={errors.phone}
        onChange={(e) => set('phone', e.target.value)}
      />
      {attending === 'yes' && (
        <div className="grid grid-cols-2 gap-4">
          <TextInput
            id="rsvp-adults"
            label="Adults"
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={v.adults}
            error={errors.adults}
            onChange={(e) => set('adults', e.target.value)}
          />
          <TextInput
            id="rsvp-children"
            label="Children"
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={v.children}
            error={errors.children}
            onChange={(e) => set('children', e.target.value)}
          />
        </div>
      )}
      <div
        className="absolute top-auto -left-[9999px] h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="rsvp-website">Leave this empty</label>
        <input
          id="rsvp-website"
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
        <PrimaryButton pending={pending}>Send RSVP</PrimaryButton>
        {pending && <FormStatus>Sending.</FormStatus>}
      </div>
    </form>
  );
}
