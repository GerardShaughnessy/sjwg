import { useState } from 'react';
import { auth } from '@/lib/store';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/config/site';
import { FormStatus, PrimaryButton, TextInput } from '@/components/forms/fields';

/** Demo login. Two accounts, one password, no server. */
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter the email and password for one of the demo accounts below.');
      return;
    }
    setPending(true);
    try {
      await auth.login(email, password);
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(next && next.startsWith('/') ? next : '/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
      setPending(false);
    }
  }

  return (
    <div className="max-w-[32rem]">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        <TextInput
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          autoFocus
        />
        <TextInput
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <p
            role="alert"
            className="border-brick bg-paper text-brick border-l-4 px-4 py-3 font-sans font-semibold"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <PrimaryButton pending={pending} pendingLabel="Logging in">
            Log in
          </PrimaryButton>
          {pending && <FormStatus>Checking your login.</FormStatus>}
        </div>
      </form>

      <div
        className="border-brass bg-brass/25 mt-10 border-l-4 px-4 py-3 font-sans text-[0.95rem] leading-relaxed"
        role="note"
      >
        <p className="font-semibold">Demo accounts</p>
        <ul className="mt-1 flex flex-col gap-1">
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                className="decoration-brass underline decoration-2 underline-offset-4"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                {a.email}
              </button>{' '}
              ({a.role === 'member' ? 'Guild member' : 'customer'})
            </li>
          ))}
        </ul>
        <p className="mt-2">
          Password for both: <code className="font-sans font-semibold">{DEMO_PASSWORD}</code>.
          Nothing here is a real account.
        </p>
      </div>
    </div>
  );
}
