import { useState } from 'react';
import { GIVING_LEVELS } from '@/config/site';
import { ApiError } from '@/lib/api';
import { PrimaryButton } from '@/components/forms/fields';
import { isEmail } from '@/lib/validate';

const PRESETS = [
  { key: 'pre-apprentice', label: '$25', cents: 2_500 },
  { key: 'apprentice', label: '$500', cents: 50_000 },
  { key: 'journeyman', label: '$1,000', cents: 100_000 },
  { key: 'foreman', label: '$5,000', cents: 500_000 },
  { key: 'master', label: '$20,000', cents: 2_000_000 },
];

/** Amount, once or monthly, optional email, then Stripe's hosted page. No card fields here. */
export default function GiveForm() {
  const [choice, setChoice] = useState<string>('apprentice');
  const [other, setOther] = useState('');
  const [interval, setInterval] = useState<'once' | 'month'>('once');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const cents =
    choice === 'other'
      ? Math.round(Number(other.replace(/[^0-9.]/g, '')) * 100)
      : (PRESETS.find((p) => p.key === choice)?.cents ?? 0);
  const level = [...GIVING_LEVELS]
    .sort((a, b) => b.minCents - a.minCents)
    .find((g) => cents >= g.minCents);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!cents || cents < 100) {
      setError('Enter an amount of at least one dollar.');
      return;
    }
    if (email && !isEmail(email)) {
      setError('That email does not look right, like name@example.com.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountCents: cents,
          interval,
          tier: level?.key,
          email: email || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url)
        throw new ApiError(res.status, body.error ?? 'Could not open the payment page.');
      window.location.assign(body.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open the payment page. Try again in a minute.',
      );
      setPending(false);
    }
  }

  return (
    <form
      id="give"
      onSubmit={submit}
      className="flex flex-col gap-6 font-sans"
      aria-labelledby="give-title"
    >
      <fieldset>
        <legend id="give-title" className="text-h3 font-serif">
          Give online
        </legend>
        <p className="text-ash mt-2 text-[0.95rem]">
          Card or bank, on Stripe's secure page. Pick a level or enter any amount.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PRESETS.map((p) => (
            <label
              key={p.key}
              className={`flex cursor-pointer items-center justify-center border-2 px-2 py-3 font-semibold ${choice === p.key ? 'border-brick bg-brick text-paper' : 'border-charcoal bg-paper'}`}
            >
              <input
                type="radio"
                name="amount"
                value={p.key}
                checked={choice === p.key}
                onChange={() => setChoice(p.key)}
                className="sr-only"
              />
              {p.label}
            </label>
          ))}
          <label
            className={`flex cursor-pointer items-center justify-center border-2 px-2 py-3 font-semibold ${choice === 'other' ? 'border-brick bg-brick text-paper' : 'border-charcoal bg-paper'}`}
          >
            <input
              type="radio"
              name="amount"
              value="other"
              checked={choice === 'other'}
              onChange={() => setChoice('other')}
              className="sr-only"
            />
            Other
          </label>
        </div>
        {choice === 'other' && (
          <label className="mt-3 flex flex-col gap-1">
            <span className="font-semibold">Amount in dollars</span>
            <input
              inputMode="decimal"
              value={other}
              onChange={(e) => setOther(e.target.value)}
              className="border-charcoal bg-paper w-40 border-2 px-3 py-2"
              autoFocus
            />
          </label>
        )}
        {level && <p className="text-ash mt-3 text-[0.95rem]">That is the {level.name} level.</p>}
      </fieldset>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-2 font-semibold">How often</legend>
        {(['once', 'month'] as const).map((v) => (
          <label
            key={v}
            className={`flex cursor-pointer items-center border-2 px-4 py-2.5 font-semibold ${interval === v ? 'border-brick bg-brick text-paper' : 'border-charcoal bg-paper'}`}
          >
            <input
              type="radio"
              name="interval"
              value={v}
              checked={interval === v}
              onChange={() => setInterval(v)}
              className="sr-only"
            />
            {v === 'once' ? 'One time' : 'Every month'}
          </label>
        ))}
      </fieldset>
      <label className="flex max-w-[24rem] flex-col gap-1">
        <span className="font-semibold">
          Email <span className="text-ash font-normal">(optional)</span>
        </span>
        <span className="text-ash text-[0.9rem]">
          For your receipt. Stripe asks again if you leave it blank.
        </span>
        <input
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border-charcoal bg-paper border-2 px-3 py-2"
          autoComplete="email"
        />
      </label>
      {error && (
        <p
          role="alert"
          className="border-brick bg-paper text-brick border-l-4 px-4 py-3 font-semibold"
        >
          {error}
        </p>
      )}
      <div>
        <PrimaryButton pending={pending} pendingLabel="Opening the payment page">
          Give{' '}
          {cents >= 100
            ? `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
            : ''}{' '}
          {interval === 'month' ? 'monthly' : 'now'}
        </PrimaryButton>
      </div>
    </form>
  );
}
