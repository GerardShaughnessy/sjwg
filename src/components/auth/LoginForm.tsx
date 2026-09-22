import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { FormStatus, PrimaryButton, TextInput } from '@/components/forms/fields';
import { authMessage, safeNext } from './authErrors';

/** Member log in. No sign-up link on purpose: membership is by invitation. */
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Enter the email your invitation was sent to.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (next.email || next.password) return;
    setPending(true);
    const { error } = await authClient().signIn.email({ email: email.trim(), password });
    if (error) {
      setErrors({ form: authMessage(error, 'Could not log in. Try again in a minute.') });
      setPending(false);
      return;
    }
    const target = safeNext(new URLSearchParams(window.location.search).get('next'));
    window.location.assign(target);
  }

  return (
    <div className="max-w-[32rem]">
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        <TextInput
          id="email"
          label="Email"
          type="email"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          inputMode="email"
          autoFocus
        />
        <TextInput
          id="password"
          label="Password"
          type="password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {errors.form && (
          <p
            role="alert"
            className="border-brick bg-paper text-brick border-l-4 px-4 py-3 font-sans font-semibold"
          >
            {errors.form}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <PrimaryButton pending={pending} pendingLabel="Logging in">
            Log in
          </PrimaryButton>
          <a
            href="/forgot-password"
            className="decoration-brass hover:decoration-charcoal font-sans font-medium underline decoration-2 underline-offset-4"
          >
            Forgot your password?
          </a>
          {pending && <FormStatus>Checking your login.</FormStatus>}
        </div>
      </form>
      <p className="text-ash mt-10 max-w-[48ch] font-sans text-[0.95rem] leading-relaxed">
        Accounts are for Guild members and officers. If you were told you have one but cannot get
        in, ask the officer who invited you to send a new link.
      </p>
    </div>
  );
}
