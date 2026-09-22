import { createAuthClient, type VanillaBetterAuthClient } from '@neondatabase/auth';

/**
 * Browser-side Better Auth client. It talks to our own /api/auth proxy, never
 * to Neon directly, so cookies land on this domain. Built lazily: islands are
 * also rendered on the server, where there is no origin to point at.
 */
type Client = VanillaBetterAuthClient;
let client: Client | null = null;

export function authClient(): Client {
  if (typeof window === 'undefined') throw new Error('authClient() is browser-only');
  if (!client) client = createAuthClient(`${window.location.origin}/api/auth`) as unknown as Client;
  return client;
}

/** Sign up with an invitation token. The proxy refuses sign-ups without one. */
export async function signUpWithInvite(opts: {
  email: string;
  password: string;
  name: string;
  token: string;
}) {
  return authClient().signUp.email(
    { email: opts.email, password: opts.password, name: opts.name },
    { headers: { 'x-invite-token': opts.token } },
  );
}
