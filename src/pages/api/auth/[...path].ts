import type { APIRoute } from 'astro';
import { handleAuthProxyRequest } from '@neondatabase/auth/server';
import { authConfig } from '@/server/auth/server';
import { guardSignUp } from '@/server/auth/signup-gate';

export const prerender = false;

/**
 * Proxies every auth call to Neon and re-issues the session cookies on this
 * domain. Sign-up is gated: only an opened, unexpired invitation may create a
 * user, so the login page never needs a "create account" link.
 */
const handler: APIRoute = async (ctx) => {
  const path = ctx.params.path ?? '';
  if (path === 'sign-up/email') {
    const denied = await guardSignUp(ctx);
    if (denied) return denied;
  }
  const c = authConfig();
  return handleAuthProxyRequest({
    request: ctx.request,
    path,
    baseUrl: c.baseUrl,
    cookieSecret: c.cookieSecret,
    sessionDataTtl: c.sessionDataTtl,
    sameSite: c.sameSite,
    log: c.log,
  });
};

export const GET = handler;
export const POST = handler;
