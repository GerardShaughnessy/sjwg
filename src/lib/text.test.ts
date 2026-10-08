import { describe, expect, it } from 'vitest';
import { titleCase } from './text';

describe('titleCase', () => {
  it('capitalizes every word', () => {
    expect(titleCase('Guild holy hour')).toBe('Guild Holy Hour');
    expect(titleCase('guild christmas party')).toBe('Guild Christmas Party');
  });
  it('keeps short joining words lower in the middle', () => {
    expect(titleCase('st. joseph the worker procession')).toBe('St. Joseph the Worker Procession');
    expect(titleCase('the retreat of the year')).toBe('The Retreat of the Year');
  });
  it('leaves words with inner capitals alone and handles extra spaces', () => {
    expect(titleCase('  SJWG work   day ')).toBe('SJWG Work Day');
    expect(titleCase("tradesmen's mass")).toBe("Tradesmen's Mass");
  });
});
