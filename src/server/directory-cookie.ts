import { createHmac, timingSafeEqual } from 'node:crypto';
import { env, isProduction } from './env';

/**
 * The `sjwg_dir` cookie says a visitor affirmed the directory terms. Its value
 * is `${termsVersion}.${expiryEpochSeconds}.${hmac}`, signed with a key derived
 * from the auth cookie secret. A new terms version or an expired date means the
 * visitor sees the gate again.
 */
export const DIR_COOKIE = 'sjwg_dir';
export const DIR_COOKIE_TTL_MS = 365 * 24 * 60 * 60 * 1000;

const DEV_SECRET = 'sjwg-dev-directory-secret-not-for-production';

/** Reuses NEON_AUTH_COOKIE_SECRET. A dev constant only outside production. */
export function dirCookieSecret(): string {
  const s = env('NEON_AUTH_COOKIE_SECRET');
  if (s) return s;
  if (isProduction()) throw new Error('Missing environment variable NEON_AUTH_COOKIE_SECRET.');
  return DEV_SECRET;
}

function mac(payload: string, secret: string): string {
  return createHmac('sha256', `sjwg-dir:${secret}`).update(payload).digest('base64url');
}

export function signDirCookie(
  termsVersion: string,
  secret: string,
  now = Date.now(),
): { value: string; expires: Date } {
  const expires = new Date(now + DIR_COOKIE_TTL_MS);
  const payload = `${termsVersion}.${Math.floor(expires.getTime() / 1000)}`;
  return { value: `${payload}.${mac(payload, secret)}`, expires };
}

export function verifyDirCookie(
  value: string | undefined | null,
  termsVersion: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  const [version, exp, sig] = parts;
  const expected = Buffer.from(mac(`${version}.${exp}`, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  if (version !== termsVersion) return false;
  const expSec = Number(exp);
  return Number.isFinite(expSec) && expSec * 1000 > now;
}
