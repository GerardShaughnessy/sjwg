import { useState } from 'react';
import { signUpWithInvite } from '@/lib/auth-client';
import { invitations } from '@/lib/api';
import { PrimaryButton, Select, TextInput } from '@/components/forms/fields';
import { COMMON_TRADES, OTHER_TRADE } from '@/lib/trades';
import { authMessage } from './authErrors';
import { MIN_PASSWORD } from './ResetPasswordForm';

interface Props {
  token: string;
  email: string;
  name: string;
  /** No directory entry yet: he sets one up here (trade and phone), and finishes it in My entry. */
  needsEntry: boolean;
}

export default function AcceptInviteForm({ token, email, name: initialName, needsEntry }: Props) {
  const [name, setName] = useState(initialName);
  const [tradeChoice, setTradeChoice] = useState('');
  const [otherTrade, setOtherTrade] = useState('');
  const [phone, setPhone] = useState('');
  const trade = tradeChoice === OTHER_TRADE ? otherTrade.trim() : tradeChoice;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    trade?: string;
    password?: string;
    confirm?: string;
    form?: string;
  }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Tell us your name as other members should see it.';
    if (needsEntry && !trade) next.trade = 'Pick your trade.';
    if (password.length < MIN_PASSWORD) next.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (confirm !== password) next.confirm = 'The two passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    const { error } = await signUpWithInvite({ email, password, name: name.trim(), token });
    if (error) {
      setErrors({
        form: authMessage(
          error,
          'Could not create the account. Ask the officer who invited you to send a new link.',
        ),
      });
      setPending(false);
      return;
    }
    try {
      await invitations.complete(token, { trade, phone: phone.trim() });
    } catch (err) {
      setErrors({
        form:
          err instanceof Error
            ? err.message
            : 'The account was created but could not be linked. Ask an officer.',
      });
      setPending(false);
      return;
    }
    window.location.assign(needsEntry ? '/portal?tab=profile' : '/portal');
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex max-w-[32rem] flex-col gap-6">
      <TextInput
        id="email"
        label="Email"
        type="email"
        value={email}
        readOnly
        autoComplete="username"
        hint="The invitation is tied to this address."
      />
      <TextInput
        id="name"
        label="Your name"
        value={name}
        error={errors.name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        autoFocus={!initialName}
      />
      {needsEntry && (
        <>
          <Select
            id="trade"
            label="Your trade"
            value={tradeChoice}
            error={errors.trade}
            onChange={(e) => setTradeChoice(e.target.value)}
          >
            <option value="">Pick a trade</option>
            {COMMON_TRADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value={OTHER_TRADE}>Other (type it in)</option>
          </Select>
          {tradeChoice === OTHER_TRADE && (
            <TextInput
              id="other-trade"
              label="Which trade?"
              value={otherTrade}
              error={errors.trade}
              onChange={(e) => setOtherTrade(e.target.value)}
              placeholder="For example, Stained Glass"
            />
          )}
          <TextInput
            id="phone"
            label="Phone"
            optional
            hint="Officers only, for referrals. Never shown publicly."
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </>
      )}
      <TextInput
        id="password"
        label="Choose a password"
        hint={`At least ${MIN_PASSWORD} characters. A short sentence works well.`}
        type="password"
        value={password}
        error={errors.password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        autoFocus={Boolean(initialName)}
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
          {errors.form}
        </p>
      )}
      <div>
        <PrimaryButton pending={pending} pendingLabel="Setting up your account">
          {needsEntry ? 'Create my account' : 'Set password and log in'}
        </PrimaryButton>
      </div>
    </form>
  );
}
