import { defineMiddleware } from 'astro:middleware';
import {
  processAuthMiddleware,
  DEFAULT_AUTH_SKIP_ROUTES,
  NEON_AUTH_COOKIE_PREFIX,
} from '@neondatabase/auth/server';
import { authConfig, getAuthSessionState, resolveAppSession } from '@/server/auth/server';
import { AUTH_PAGES, decideGate, unavailableHtml, type UpstreamStatus } from '@/server/auth/gate';

/** Pages and API prefixes that need a logged-in Guild member (or officer). */
const PROTECTED = [
  /^\/portal(\/|$)/,
  /^\/api\/(requests|me|posts|events|sponsors|donations|invitations|members|announcements|hours|portal|users|tasks|agreements|files\/requests)(\/|$)/,
];

/** Method-specific holes in the protected prefixes. */
function isPublicException(method: string, pathname: string): boolean {
  if (method === 'POST' && /^\/api\/requests\/?$/.test(pathname)) return true; // the help wizard
  if (method === 'POST' && /^\/api\/invitations\/complete\/?$/.test(pathname)) return true; // identity, no account yet
  if (method === 'GET' && /^\/api\/(events|sponsors)\/?$/.test(pathname)) return true; // public listings
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendered pages run this at build time. Nothing to do.
  if (context.isPrerendered) return next();
  context.locals.session = null;

  const { pathname } = context.url;
  const method = context.request.method;
  const isApi = pathname.startsWith('/api/');
  const needsAuth =
    PROTECTED.some((re) => re.test(pathname)) && !isPublicException(method, pathname);
  const hasAuthCookie = (context.request.headers.get('cookie') ?? '').includes(
    NEON_AUTH_COOKIE_PREFIX,
  );

  // Nothing to gate and nobody logged in: pass straight through.
  if (!needsAuth && !AUTH_PAGES.test(pathname) && !hasAuthCookie) return next();

  const c = authConfig();
  const result = await processAuthMiddleware({
    request: context.request,
    pathname,
    skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
    loginUrl: '/login',
    baseUrl: c.baseUrl,
    cookieSecret: c.cookieSecret,
    sessionDataTtl: c.sessionDataTtl,
    sameSite: c.sameSite,
    log: c.log,
  });

  const withCookies = (res: Response, cookies?: string[]) => {
    for (const cookie of cookies ?? []) res.headers.append('set-cookie', cookie);
    return res;
  };

  if (result.action === 'redirect_oauth') {
    return withCookies(context.redirect(result.redirectUrl.toString(), 302), result.cookies);
  }

  // Ask Neon Auth who this is whenever there is a login cookie. A failure to
  // reach it is not a logout: it gets a retry, not the login page.
  let upstream: UpstreamStatus = 'none';
  if (hasAuthCookie) {
    const state = await getAuthSessionState(context);
    upstream = state.status;
    // An enabled app_users row turns the sign-in into a Guild session.
    if (state.session) context.locals.session = await resolveAppSession(state.session);
  }

  const decision = decideGate({
    pathname,
    search: context.url.search,
    needsAuth,
    upstream,
    hasAppSession: Boolean(context.locals.session),
  });

  switch (decision.kind) {
    case 'redirect':
      return withCookies(context.redirect(decision.to, 302), result.cookies);
    case 'json':
      return withCookies(
        new Response(JSON.stringify({ error: decision.error }), {
          status: decision.status,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
        result.cookies,
      );
    case 'unavailable':
      return withCookies(
        new Response(unavailableHtml(), {
          status: 503,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
            'retry-after': '10',
          },
        }),
        result.cookies,
      );
    default:
      return withCookies(await next(), result.cookies);
  }
});
