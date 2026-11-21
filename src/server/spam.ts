import { createHmac, timingSafeEqual } from 'node:crypto';
import { dirCookieSecret } from './directory-cookie';

/**
 * A light spam check with no third party. The form fetches a signed token when
 * it opens; the server refuses a submission that comes back too fast (a bot
 * fills a form in well under a few seconds), too late, or with a forged token.
 * Database limits per IP hash and per email back it up across server instances.
 */
export const FORM_TOKEN_MIN_MS = 3_000;
export const FORM_TOKEN_MAX_MS = 24 * 60 * 60 * 1000;

const mac = (payload: string) =>
  createHmac('sha256', `form:${dirCookieSecret()}`).update(payload).digest('base64url');

export function issueFormToken(form: string, now = Date.now()): string {
  const payload = `${form}.${now}`;
  return `${payload}.${mac(payload)}`;
}

export type FormTokenCheck = 'ok' | 'missing' | 'forged' | 'too-fast' | 'expired';

export function checkFormToken(form: string, token: unknown, now = Date.now()): FormTokenCheck {
  if (typeof token !== 'string' || !token) return 'missing';
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== form) return 'forged';
  const [f, ts, sig] = parts;
  const expected = Buffer.from(mac(`${f}.${ts}`));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return 'forged';
  const age = now - Number(ts);
  if (!Number.isFinite(age) || age < FORM_TOKEN_MIN_MS) return 'too-fast';
  if (age > FORM_TOKEN_MAX_MS) return 'expired';
  return 'ok';
}

/** A friendly message for each failure. A bot never reads it; a person might. */
export function formTokenMessage(c: Exclude<FormTokenCheck, 'ok'>): string {
  return c === 'expired'
    ? 'This page has been open a long time. Reload it and try again.'
    : c === 'too-fast'
      ? 'That was very fast. Take a moment to check your answers, then send again.'
      : 'Something went wrong with the form. Reload the page and try again.';
}
