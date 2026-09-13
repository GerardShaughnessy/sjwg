import { describe, it, expect } from 'vitest';
import { makeRef, makeId } from './ids';

describe('ids', () => {
  it('makes a reference number shaped SJWG-XXXXXX with unambiguous characters', () => {
    for (let i = 0; i < 50; i++)
      expect(makeRef()).toMatch(/^SJWG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
  it('makes prefixed unique ids', () => {
    const a = makeId('req');
    const b = makeId('req');
    expect(a).toMatch(/^req-/);
    expect(a).not.toBe(b);
  });
});
