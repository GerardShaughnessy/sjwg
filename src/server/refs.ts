import { createHash, randomBytes } from 'node:crypto';

/** No 0/O or 1/I so a reference can be read over the phone. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRef(): string {
  const bytes = randomBytes(6);
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `SJWG-${s}`;
}

export const REF_PATTERN = /^SJWG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** 256-bit random token, URL safe. Only the hash is stored. */
export function makeToken(): string {
  return randomBytes(32).toString('base64url');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Hash an IP for rate limiting without storing the address. */
export function hashIp(ip: string | null | undefined, salt = 'sjwg'): string | null {
  if (!ip) return null;
  return sha256(`${salt}:${ip}`).slice(0, 32);
}

/**
 * Retry an insert whose only likely failure is a unique-key collision on a
 * generated value. Postgres unique violations are SQLSTATE 23505.
 */
export async function withUniqueRetry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw last;
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === '23505' || e?.cause?.code === '23505';
}

/* Reversible storage for the tracking token so later emails (a member's note)
 * can carry the requester's link. AES-256-GCM keyed from the cookie secret. */
import { createCipheriv, createDecipheriv } from 'node:crypto';

function aesKey(secret: string): Buffer {
  return createHash('sha256').update(`sjwg-token:${secret}`).digest();
}

export function encryptToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey(secret), iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
}

export function decryptToken(blob: string, secret: string): string | null {
  try {
    const buf = Buffer.from(blob, 'base64url');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', aesKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
