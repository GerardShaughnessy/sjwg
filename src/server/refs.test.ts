import { describe, expect, it } from 'vitest';
import {
  REF_PATTERN,
  hashIp,
  isUniqueViolation,
  makeRef,
  makeToken,
  sha256,
  withUniqueRetry,
} from './refs';

describe('makeRef', () => {
  it('produces phone-friendly references', () => {
    for (let i = 0; i < 200; i++) {
      const r = makeRef();
      expect(r).toMatch(REF_PATTERN);
      expect(r).not.toMatch(/[01IO]/);
    }
  });
  it('is not obviously repeating', () => {
    const set = new Set(Array.from({ length: 500 }, makeRef));
    expect(set.size).toBeGreaterThan(495);
  });
});

describe('tokens', () => {
  it('makes 43-char base64url tokens and stable hashes', () => {
    const t = makeToken();
    expect(t).toHaveLength(43);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sha256(t)).toHaveLength(64);
    expect(sha256(t)).toBe(sha256(t));
    expect(sha256(t)).not.toBe(sha256(makeToken()));
  });
  it('hashes ips without keeping them', () => {
    expect(hashIp(null)).toBeNull();
    expect(hashIp('1.2.3.4')).toHaveLength(32);
    expect(hashIp('1.2.3.4')).not.toContain('1.2.3.4');
  });
});

describe('withUniqueRetry', () => {
  it('retries only on unique violations', async () => {
    let n = 0;
    const out = await withUniqueRetry(async () => {
      n++;
      if (n < 3) throw Object.assign(new Error('dup'), { code: '23505' });
      return 'ok';
    });
    expect(out).toBe('ok');
    expect(n).toBe(3);
    await expect(
      withUniqueRetry(async () => {
        throw new Error('other');
      }),
    ).rejects.toThrow('other');
  });
  it('recognises wrapped driver errors', () => {
    expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
    expect(isUniqueViolation({ code: '42P01' })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe('token encryption', async () => {
  const { encryptToken, decryptToken } = await import('./refs');
  it('round-trips and rejects tampering', () => {
    const t = makeToken();
    const enc = encryptToken(t, 'a-secret-at-least-32-characters-long');
    expect(enc).not.toContain(t);
    expect(decryptToken(enc, 'a-secret-at-least-32-characters-long')).toBe(t);
    expect(decryptToken(enc, 'another-secret-at-least-32-chars-x')).toBeNull();
    expect(
      decryptToken(enc.slice(0, -2) + 'zz', 'a-secret-at-least-32-characters-long'),
    ).toBeNull();
  });
});
