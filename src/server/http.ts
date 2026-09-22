import type { APIContext } from 'astro';
import type { AppSession, Role } from './auth/server';

export const JSON_HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

/** Errors that say what to fix. `fields` maps a field id to its message. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
  toResponse() {
    return json(
      { error: this.message, ...(this.fields ? { fields: this.fields } : {}) },
      this.status,
    );
  }
}

export function badRequest(message: string, fields?: Record<string, string>) {
  return new HttpError(400, message, fields);
}

export const notFound = (what = 'That was not found.') => new HttpError(404, what);

/** Wrap a route so thrown HttpErrors become JSON and anything else becomes a 500. */
export function route(fn: (ctx: APIContext) => Promise<Response>) {
  return async (ctx: APIContext) => {
    try {
      return await fn(ctx);
    } catch (err) {
      if (err instanceof HttpError) return err.toResponse();
      console.error(`[api] ${ctx.request.method} ${new URL(ctx.request.url).pathname}`, err);
      return json({ error: 'Something went wrong on our end. Try again in a minute.' }, 500);
    }
  };
}

export function requireSession(ctx: APIContext): AppSession {
  const s = ctx.locals.session;
  if (!s) throw new HttpError(401, 'Log in to do that.');
  return s;
}

export function requireRole(ctx: APIContext, role: Role): AppSession {
  const s = requireSession(ctx);
  if (role === 'admin' && s.role !== 'admin')
    throw new HttpError(403, 'Only Guild officers can do that.');
  return s;
}

export async function readJson<T = unknown>(ctx: APIContext): Promise<T> {
  try {
    return (await ctx.request.json()) as T;
  } catch {
    throw badRequest('The request body was not valid JSON.');
  }
}

export function clientIp(ctx: APIContext): string | null {
  return (
    ctx.request.headers.get('x-nf-client-connection-ip') ??
    ctx.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    ctx.clientAddress ??
    null
  );
}

/* Tiny in-memory rate limiter. Per function instance, so it is a speed bump, not a wall. */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
