import { defineMiddleware } from 'astro:middleware';
import {
  processAuthMiddleware,
  DEFAULT_AUTH_SKIP_ROUTES,
  NEON_AUTH_COOKIE_PREFIX,
} from '@neondatabase/auth/server';
import { authConfig, getAuthSession, resolveAppSession } from '@/server/auth/server';

/** Pages and API prefixes that need a logged-in Guild member (or officer). */
const PROTECTED = [
  /^\/portal(\/|$)/,
  /^\/api\/(requests|me|posts|events|sponsors|donations|invitations|members|announcements|files\/requests)(\/|$)/,
];

/** Method-specific holes in the protected prefixes. */
function isPublicException(method: string, pathname: string): boolean {
  if (method === 'POST' && /^\/api\/requests\/?$/.test(pathname)) return true; // the help wizard
  if (method === 'POST' && /^\/api\/invitations\/complete\/?$/.test(pathname)) return true; // identity, no account yet
  if (method === 'GET' && /^\/api\/(events|sponsors)\/?$/.test(pathname)) return true; // public listings
  return false;
}

const AUTH_PAGES = /^\/(login|forgot-password|reset-password)\/?$/;

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

  // Resolve the Guild-side session (role, member link) whenever an upstream session exists.
  if (result.action === 'allow') {
    const upstream = await getAuthSession(context).catch(() => null);
    context.locals.session = await resolveAppSession(upstream);
  }

  if (AUTH_PAGES.test(pathname)) {
    if (context.locals.session) return context.redirect('/portal', 302);
    return withCookies(await next(), result.cookies);
  }

  if (needsAuth && !context.locals.session) {
    if (isApi) {
      return withCookies(
        new Response(JSON.stringify({ error: 'Log in to do that.' }), {
          status: 401,
          headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        }),
        result.cookies,
      );
    }
    const nextUrl = encodeURIComponent(pathname + context.url.search);
    return withCookies(context.redirect(`/login?next=${nextUrl}`, 302), result.cookies);
  }

  return withCookies(await next(), result.cookies);
});
