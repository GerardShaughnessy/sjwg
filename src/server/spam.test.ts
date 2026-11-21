import { describe, expect, it } from 'vitest';
import { checkFormToken, issueFormToken } from './spam';

describe('form token', () => {
  const t0 = 1_800_000_000_000;
  it('passes a token used after a few seconds', () => {
    expect(checkFormToken('dir', issueFormToken('dir', t0), t0 + 5_000)).toBe('ok');
    expect(checkFormToken('dir', issueFormToken('dir', t0), t0 + 2 * 3600_000)).toBe('ok');
  });
  it('refuses instant, stale, forged, wrong-form, and missing tokens', () => {
    const tok = issueFormToken('dir', t0);
    expect(checkFormToken('dir', tok, t0 + 500)).toBe('too-fast');
    expect(checkFormToken('dir', tok, t0 + 2 * 3600_000 + 1)).toBe('expired');
    expect(checkFormToken('dir', tok.slice(0, -2) + 'xx', t0 + 5_000)).toBe('forged');
    expect(checkFormToken('aid', tok, t0 + 5_000)).toBe('forged');
    expect(checkFormToken('dir', undefined, t0)).toBe('missing');
    expect(checkFormToken('dir', `dir.${t0 - 10_000}.${tok.split('.')[2]}`, t0)).toBe('forged');
  });
});
