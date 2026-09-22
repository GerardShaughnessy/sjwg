/** Turn Better Auth error codes into plain sentences that say what to fix. */
export function authMessage(
  err: { code?: string; message?: string } | null | undefined,
  fallback: string,
) {
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (code === 'INVALID_EMAIL_OR_PASSWORD' || msg.includes('invalid email or password'))
    return 'That email and password do not match. Check both and try again.';
  if (code === 'USER_NOT_FOUND' || msg.includes('user not found'))
    return 'No member account uses that email. Ask a Guild officer if you need an invitation.';
  if (code === 'PASSWORD_TOO_SHORT' || msg.includes('too short'))
    return 'Use at least 10 characters for the password.';
  if (code === 'INVALID_TOKEN' || msg.includes('invalid token') || msg.includes('expired'))
    return 'That link has expired or was already used. Ask for a new one.';
  if (code === 'USER_ALREADY_EXISTS' || msg.includes('already exists'))
    return 'An account with that email already exists. Log in instead, or reset the password.';
  if (msg.includes('rate') || code === 'TOO_MANY_REQUESTS')
    return 'Too many tries in a row. Wait a minute and try again.';
  if (msg.includes('fetch') || msg.includes('network'))
    return 'Could not reach the login service. Check your connection and try again.';
  return err?.message && err.message.length < 140 ? err.message : fallback;
}

export function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/portal';
}
