import { describe, expect, it } from 'vitest';
import { affirmSchema, chicagoToday, isNearToday } from './directory';
import { AFFIRMATION_IDS, DIRECTORY_TERMS_VERSION } from '@/config/directory-terms';

const allTrue = Object.fromEntries(AFFIRMATION_IDS.map((id) => [id, true]));
const good = {
  fullName: 'Mary Smith',
  email: 'Mary@Example.com',
  signedDate: chicagoToday(),
  catholic: 'catholic',
  alignmentNote: '',
  affirm: allTrue,
};

describe('affirmSchema', () => {
  it('accepts a complete affirmation', () => {
    const r = affirmSchema.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('mary@example.com');
  });

  it('requires every box', () => {
    for (const id of AFFIRMATION_IDS) {
      const r = affirmSchema.safeParse({ ...good, affirm: { ...allTrue, [id]: false } });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].path).toEqual(['affirm', id]);
    }
    expect(affirmSchema.safeParse({ ...good, affirm: {} }).success).toBe(false);
  });

  it('requires a note when not Catholic, under 2000 characters', () => {
    const base = { ...good, catholic: 'not-catholic' };
    expect(affirmSchema.safeParse(base).success).toBe(false);
    expect(affirmSchema.safeParse({ ...base, alignmentNote: 'We share the values.' }).success).toBe(
      true,
    );
    expect(affirmSchema.safeParse({ ...base, alignmentNote: 'x'.repeat(2001) }).success).toBe(
      false,
    );
  });

  it('requires a Catholic status, a name and a valid email', () => {
    expect(affirmSchema.safeParse({ ...good, catholic: '' }).success).toBe(false);
    expect(affirmSchema.safeParse({ ...good, fullName: '  ' }).success).toBe(false);
    expect(affirmSchema.safeParse({ ...good, email: 'nope' }).success).toBe(false);
  });

  it('accepts dates within two days of today only', () => {
    const now = new Date('2026-11-21T18:00:00Z');
    expect(isNearToday('2026-11-21', now)).toBe(true);
    expect(isNearToday('2026-11-19', now)).toBe(true);
    expect(isNearToday('2026-11-23', now)).toBe(true);
    expect(isNearToday('2026-11-18', now)).toBe(false);
    expect(isNearToday('2026-11-24', now)).toBe(false);
    expect(isNearToday('2026-02-30', now)).toBe(false);
    expect(isNearToday('11/21/2026', now)).toBe(false);
  });

  it('uses the Chicago date, not UTC', () => {
    // 03:00 UTC on the 22nd is still the 21st in St. Louis.
    expect(chicagoToday(new Date('2026-11-22T03:00:00Z'))).toBe('2026-11-21');
  });
});

describe('DIRECTORY_TERMS_VERSION', () => {
  it('is 16 hex characters', () => {
    expect(DIRECTORY_TERMS_VERSION).toMatch(/^[0-9a-f]{16}$/);
  });
});
