import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header row and quotes fields with commas, quotes, or newlines', () => {
    const out = toCsv([
      { name: 'Sample, Donor', amount: 25, note: 'said "thanks"' },
      { name: 'Plain', amount: 500, note: 'line1\nline2' },
    ]);
    expect(out.split('\r\n')).toEqual([
      'name,amount,note',
      '"Sample, Donor",25,"said ""thanks"""',
      'Plain,500,"line1\nline2"',
    ]);
  });
  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('');
  });
});
