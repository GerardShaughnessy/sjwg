import { useState } from 'react';
import { emailList } from '@/lib/api';
import { isEmail } from '@/lib/validate';

type Props = {
  /** Where the sign-up came from, kept with the address. */
  source: 'popup' | 'footer' | 'contact' | 'donate';
  /** Dark sections (popup, footer) or light ones (contact, donate). */
  tone?: 'dark' | 'light';
  /** Ask for a first name as well. */
  withName?: boolean;
  /** Called after a successful sign-up, so the popup can close itself. */
  onDone?: () => void;
  submitLabel?: string;
};

export const SUBSCRIBED_KEY = 'sjwg:v1:subscribed';

/** Email-list sign-up. Email only (name optional), one click, no account. */
export default function SubscribeForm({
  source,
  tone = 'light',
  withName = false,
  onDone,
  submitLabel = 'Sign up',
}: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState('');

  const dark = tone === 'dark';
  const input = dark
    ? 'w-full border-2 border-stone/60 bg-transparent px-3 py-2.5 text-stone placeholder:text-stone/55 focus:border-stone focus:outline-none'
    : 'w-full border-2 border-charcoal/70 bg-paper px-3 py-2.5 text-charcoal placeholder:text-ash focus:border-charcoal focus:outline-none';
  const button = dark
    ? 'shrink-0 border-2 border-stone bg-stone px-5 py-2.5 font-semibold text-charcoal hover:bg-transparent hover:text-stone disabled:opacity-60'
    : 'shrink-0 border-2 border-brick bg-brick px-5 py-2.5 font-semibold text-stone hover:bg-kiln disabled:opacity-60';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isEmail(email.trim())) {
      setError('That email does not look right, like name@example.com.');
      return;
    }
    setState('sending');
    try {
      await emailList.subscribe({ email: email.trim(), name: name.trim(), source, website });
      try {
        localStorage.setItem(SUBSCRIBED_KEY, JSON.stringify({ at: new Date().toISOString() }));
      } catch {
        /* storage unavailable: the popup may ask again, which is harmless */
      }
      setState('done');
      window.dispatchEvent(new CustomEvent('sjwg:subscribed', { detail: { source } }));
      onDone?.();
    } catch (err) {
      setState('idle');
      setError(
        err instanceof Error ? err.message : 'Could not sign you up. Try again in a minute.',
      );
    }
  }

  if (state === 'done') {
    return (
      <p
        role="status"
        className={`font-sans font-semibold ${dark ? 'text-stone' : 'text-charcoal'}`}
      >
        You are on the list. Thank you, and God bless.
      </p>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="font-sans">
      <div className="flex flex-col gap-3">
        {withName && (
          <label className="block">
            <span className="sr-only">First name (optional)</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="given-name"
              placeholder="First name (optional)"
              className={input}
            />
          </label>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="block flex-1">
            <span className="sr-only">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="Your email"
              required
              aria-invalid={error ? true : undefined}
              className={input}
            />
          </label>
          <button type="submit" disabled={state === 'sending'} className={button}>
            {state === 'sending' ? 'Signing up…' : submitLabel}
          </button>
        </div>
        {/* Honeypot, hidden from people and screen readers. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
      </div>
      {error && (
        <p role="alert" className={`mt-2 text-[0.9rem] ${dark ? 'text-brass-glow' : 'text-brick'}`}>
          {error}
        </p>
      )}
    </form>
  );
}
