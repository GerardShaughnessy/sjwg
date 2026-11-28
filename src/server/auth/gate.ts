/**
 * The middleware's decisions as a pure function, so tests need no request,
 * no Neon Auth, and no database.
 */
import { safeNextPath } from '@/lib/safe-next';

/** What Neon Auth said about this request's login. */
export type UpstreamStatus =
  /** A valid sign-in session. */
  | 'ok'
  /** Confirmed: nobody is signed in (no cookie, expired, or signed out). */
  | 'none'
  /** Neon Auth could not be reached or failed. We do not know who this is. */
  | 'error';

export interface GateInput {
  pathname: string;
  /** The query string, with its leading `?`, or empty. */
  search: string;
  /** The path needs a Guild session (and is not a public exception). */
  needsAuth: boolean;
  upstream: UpstreamStatus;
  /** An enabled app_users row exists for the signed-in user. */
  hasAppSession: boolean;
}

export type GateDecision =
  | { kind: 'next' }
  | { kind: 'redirect'; to: string }
  | { kind: 'json'; status: number; error: string }
  /** A portal page while Neon Auth is down: show a retry page, not /login. */
  | { kind: 'unavailable' };

export const AUTH_UNAVAILABLE = 'We could not reach the sign-in service. Try again in a moment.';
export const ACCOUNT_DISABLED =
  "This account is turned off or not set up. Ask the Guild's Admin for help (hello@sjwg.org).";
export const LOG_IN = 'Log in to do that.';

export const AUTH_PAGES = /^\/(login|forgot-password|reset-password)\/?$/;
const RESET_PAGE = /^\/reset-password\/?$/;
const LOGIN_PAGE = /^\/login\/?$/;

export function decideGate(i: GateInput): GateDecision {
  const isApi = i.pathname.startsWith('/api/');

  // A reset link must work even for someone already signed in (maybe as someone else).
  if (RESET_PAGE.test(i.pathname)) return { kind: 'next' };

  if (AUTH_PAGES.test(i.pathname)) {
    if (!i.hasAppSession) return { kind: 'next' };
    if (LOGIN_PAGE.test(i.pathname)) {
      const next = new URLSearchParams(i.search).get('next');
      return { kind: 'redirect', to: safeNextPath(next) ?? '/portal' };
    }
    return { kind: 'redirect', to: '/portal' };
  }

  if (!i.needsAuth || i.hasAppSession) return { kind: 'next' };

  if (i.upstream === 'error') {
    return isApi ? { kind: 'json', status: 503, error: AUTH_UNAVAILABLE } : { kind: 'unavailable' };
  }
  if (i.upstream === 'ok') {
    // Signed in to Neon Auth, but no enabled Guild account: do not bounce to /login and back.
    return isApi
      ? { kind: 'json', status: 403, error: ACCOUNT_DISABLED }
      : { kind: 'redirect', to: '/login?reason=disabled' };
  }
  if (isApi) return { kind: 'json', status: 401, error: LOG_IN };
  return { kind: 'redirect', to: `/login?next=${encodeURIComponent(i.pathname + i.search)}` };
}

/** A plain retry page for portal pages while Neon Auth is unreachable. */
export function unavailableHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Try again in a moment | St. Joseph the Worker Guild</title>
<style>
body{margin:0;background:#efe9dc;color:#2b2a26;font-family:system-ui,-apple-system,sans-serif;line-height:1.5}
main{max-width:36rem;margin:0 auto;padding:4rem 1rem}
h1{font-family:Georgia,serif;font-weight:400;font-size:1.75rem;margin:0 0 1rem}
a.btn{display:inline-block;margin-top:1.5rem;background:#8f3b2a;color:#fff;padding:.75rem 1.5rem;font-weight:600;text-decoration:none}
a.home{margin-left:1rem;color:inherit}
</style>
</head>
<body>
<main>
<h1>Try again in a moment</h1>
<p>${AUTH_UNAVAILABLE} You are not logged out.</p>
<a class="btn" href="">Try again</a><a class="home" href="/">Guild home page</a>
</main>
</body>
</html>`;
}

/**
 * Sort a Neon Auth getSession result. A 4xx (other than a timeout or rate
 * limit) or an empty answer means nobody is signed in; a 5xx, a transport
 * failure (reported as 502), or no status at all means we could not tell.
 */
export function classifySessionResult(r: {
  data?: { user?: unknown } | null;
  error?: { status?: number } | null;
}): UpstreamStatus {
  if (r.error) {
    const s = r.error.status;
    if (typeof s === 'number' && s >= 400 && s < 500 && s !== 408 && s !== 429) return 'none';
    return 'error';
  }
  return r.data?.user ? 'ok' : 'none';
}
