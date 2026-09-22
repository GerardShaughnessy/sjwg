import type { APIContext } from 'astro';
import type { RequestContext } from '@neondatabase/auth/server';
import { extractNeonAuthCookies } from '@neondatabase/auth/server';

/**
 * Bridges Astro's request/response to the Neon Auth server toolkit.
 * Mirrors the Hono example in @neondatabase/auth/BUILDING-AN-ADAPTER.md.
 */
export function astroRequestContext(ctx: APIContext): RequestContext {
  const headers = ctx.request.headers;
  return {
    getCookies: () => extractNeonAuthCookies(headers.get('cookie') ?? ''),
    setCookie: (name, value, options) => {
      ctx.cookies.set(name, value, {
        maxAge: options.maxAge,
        expires: options.expires,
        path: options.path ?? '/',
        domain: options.domain,
        secure: options.secure,
        httpOnly: options.httpOnly,
        sameSite: options.sameSite,
        partitioned: options.partitioned,
      });
    },
    getHeader: (name) => headers.get(name),
    getOrigin: () => headers.get('origin') ?? new URL(ctx.request.url).origin,
    getFramework: () => 'astro',
  };
}
