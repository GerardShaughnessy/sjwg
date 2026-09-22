import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { PrimaryButton, TextInput } from '@/components/forms/fields';
import { authMessage } from './authErrors';

export const MIN_PASSWORD = 10;

export default function ResetPasswordForm() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setToken(p.get('token') ?? '');
    if (p.get('error'))
      setErrors({ form: 'That link has expired or was already used. Ask for a new one.' });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    if (next.password || next.confirm) return;
    if (!token) {
      setErrors({ form: 'This page needs the link from your email. Open it again from there.' });
      return;
    }
    setPending(true);
    const { error } = await authClient().resetPassword({ newPassword: password, token });
    if (error) {
      setErrors({ form: authMessage(error, 'Could not save the new password.') });
      setPending(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-[48ch]">
        <h2 className="text-h3">Password saved</h2>
        <p className="mt-4 font-sans text-[1.0625rem] leading-relaxed">
          Log in with the new password.
        </p>
        <a
          href="/login"
          className="bg-brick text-paper hover:bg-kiln mt-6 inline-flex min-h-[3.25rem] items-center px-7 py-3 font-sans font-semibold no-underline"
        >
          Log in
        </a>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-[32rem] flex-col gap-6">
      <TextInput
        id="password"
        label="New password"
        hint={`At least ${MIN_PASSWORD} characters. A short sentence works well.`}
        type="password"
        value={password}
        error={errors.password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        autoFocus
      />
      <TextInput
        id="confirm"
        label="Type it again"
        type="password"
        value={confirm}
        error={errors.confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
      />
      {errors.form && (
        <p
          role="alert"
          className="border-brick bg-paper text-brick border-l-4 px-4 py-3 font-sans font-semibold"
        >
          {errors.form}{' '}
          <a href="/forgot-password" className="underline decoration-2 underline-offset-4">
            Send a new link
          </a>
        </p>
      )}
      <div>
        <PrimaryButton pending={pending} pendingLabel="Saving">
          Save the new password
        </PrimaryButton>
      </div>
    </form>
  );
}
