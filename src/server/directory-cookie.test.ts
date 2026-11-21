import { describe, expect, it } from 'vitest';
import { DIR_COOKIE_TTL_MS, signDirCookie, verifyDirCookie } from './directory-cookie';

const SECRET = 'a-secret-at-least-32-characters-long';
const NOW = Date.parse('2026-11-21T18:00:00Z');

describe('directory cookie', () => {
  it('verifies a value it signed', () => {
    const { value, expires } = signDirCookie('abc123', SECRET, NOW);
    expect(verifyDirCookie(value, 'abc123', SECRET, NOW)).toBe(true);
    expect(expires.getTime()).toBe(NOW + DIR_COOKIE_TTL_MS);
  });

  it('rejects a tampered value', () => {
    const { value } = signDirCookie('abc123', SECRET, NOW);
    const [v, exp, sig] = value.split('.');
    const later = `${v}.${Number(exp) + 999999}.${sig}`;
    expect(verifyDirCookie(later, 'abc123', SECRET, NOW)).toBe(false);
    expect(verifyDirCookie(`${v}.${exp}.${sig.slice(0, -2)}xx`, 'abc123', SECRET, NOW)).toBe(false);
    expect(verifyDirCookie(value, 'abc123', 'another-secret-entirely-32-chars!!', NOW)).toBe(false);
    expect(verifyDirCookie('garbage', 'abc123', SECRET, NOW)).toBe(false);
    expect(verifyDirCookie(undefined, 'abc123', SECRET, NOW)).toBe(false);
  });

  it('rejects an expired value', () => {
    const { value } = signDirCookie('abc123', SECRET, NOW);
    expect(verifyDirCookie(value, 'abc123', SECRET, NOW + DIR_COOKIE_TTL_MS + 1000)).toBe(false);
  });

  it('rejects a value signed for an older terms version', () => {
    const { value } = signDirCookie('abc123', SECRET, NOW);
    expect(verifyDirCookie(value, 'def456', SECRET, NOW)).toBe(false);
  });
});
