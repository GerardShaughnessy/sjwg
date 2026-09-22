import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { PrimaryButton, TextInput } from '@/components/forms/fields';
import { isEmail } from '@/lib/validate';
import { authMessage } from './authErrors';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError('Enter the email your account uses, like name@example.com.');
      return;
    }
    setError('');
    setPending(true);
    const { error: err } = await authClient().requestPasswordReset({
      email: email.trim(),
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPending(false);
    // Never confirm whether an address exists.
    if (err && !/not found/i.test(err.message ?? '')) {
      setError(authMessage(err, 'Could not send the link. Try again in a minute.'));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="max-w-[48ch]">
        <h2 className="text-h3">Check your email</h2>
        <p className="mt-4 font-sans text-[1.0625rem] leading-relaxed">
          If <strong>{email.trim()}</strong> belongs to a member account, a reset link is on its
          way. It works for 15 minutes. If nothing arrives, check spam, then ask an officer.
        </p>
        <a
          href="/login"
          className="decoration-brass mt-6 inline-block font-sans font-medium underline decoration-2 underline-offset-4"
        >
          Back to log in
        </a>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-[32rem] flex-col gap-6">
      <TextInput
        id="email"
        label="Email"
        hint="The address your account uses. We will send a link there."
        type="email"
        value={email}
        error={error}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
        inputMode="email"
        autoFocus
      />
      <div>
        <PrimaryButton pending={pending} pendingLabel="Sending">
          Send a reset link
        </PrimaryButton>
      </div>
    </form>
  );
}
