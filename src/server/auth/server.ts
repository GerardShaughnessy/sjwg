import type { APIContext } from 'astro';
import {
  createAuthServer,
  resolveNeonAuthLogging,
  type SessionData,
} from '@neondatabase/auth/server';
import { eq } from 'drizzle-orm';
import { astroRequestContext } from './context';
import { db } from '../db/client';
import { appUsers } from '../db/schema';
import { env, requireEnv } from '../env';

export type Role = 'admin' | 'member';

/** What every server route and page sees for a logged-in Guild member. */
export interface AppSession {
  userId: string;
  authUserId: string;
  email: string;
  name: string;
  role: Role;
  memberId: string | null;
}

const log = resolveNeonAuthLogging({ logLevel: env('NEON_AUTH_LOG_LEVEL') as never });

/** Flat config shared by the proxy route, the middleware, and the server factory. */
export function authConfig() {
  return {
    baseUrl: requireEnv('NEON_AUTH_BASE_URL'),
    cookieSecret: requireEnv('NEON_AUTH_COOKIE_SECRET'),
    sessionDataTtl: 300,
    /** lax, not strict, so links in emails (reset, invite) arrive with cookies. */
    sameSite: 'lax' as const,
    log,
  };
}

/** Better Auth server methods bound to this request's cookies. Cheap to build. */
export function authFor(ctx: APIContext) {
  const c = authConfig();
  return createAuthServer({
    baseUrl: c.baseUrl,
    context: () => astroRequestContext(ctx),
    cookieSecret: c.cookieSecret,
    sessionDataTtl: c.sessionDataTtl,
    sameSite: c.sameSite,
    log: c.log,
  });
}

/** Upstream session (Better Auth) for this request, or null. */
export async function getAuthSession(ctx: APIContext): Promise<SessionData | null> {
  const { data } = await authFor(ctx).getSession();
  return data?.user ? data : null;
}

/**
 * Identity is not authorization. A Better Auth user with no app_users row
 * (or a disabled one) gets nothing, which is what protects the portal even if
 * someone reaches the upstream sign-up endpoint directly.
 */
export async function resolveAppSession(session: SessionData | null): Promise<AppSession | null> {
  const user = session?.user;
  if (!user) return null;
  const [row] = await db().select().from(appUsers).where(eq(appUsers.authUserId, user.id)).limit(1);
  if (!row || row.disabled) return null;
  return {
    userId: row.id,
    authUserId: row.authUserId,
    email: row.email,
    name: row.name ?? user.name ?? row.email,
    role: row.role,
    memberId: row.memberId,
  };
}
