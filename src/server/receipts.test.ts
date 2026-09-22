import { describe, expect, it } from 'vitest';
import { decideReceipt, tierForAmount } from './receipts';

describe('tierForAmount', () => {
  it('picks the highest level reached', () => {
    expect(tierForAmount(2_500)?.key).toBe('pre-apprentice');
    expect(tierForAmount(49_999)?.key).toBe('pre-apprentice');
    expect(tierForAmount(50_000)?.key).toBe('apprentice');
    expect(tierForAmount(2_000_000)?.key).toBe('master');
    expect(tierForAmount(1_000)).toBeNull();
  });
});

describe('decideReceipt', () => {
  it('gives a full receipt when nothing is received in return', () => {
    const d = decideReceipt(10_000, null);
    expect(d.kind).toBe('full');
    if (d.kind === 'full') expect(d.deductibleCents).toBe(10_000);
  });
  it('holds the receipt when benefits have no fair market value yet', () => {
    const d = decideReceipt(2_000_000, {
      key: 'master',
      name: 'Master',
      benefits: ['A crucifix'],
      fmvCents: null,
    });
    expect(d.kind).toBe('pending_review');
  });
  it('subtracts the fair market value once it is set', () => {
    const d = decideReceipt(500_000, {
      key: 'foreman',
      name: 'Foreman',
      benefits: ['Key holder', 'Repair'],
      fmvCents: 25_000,
    });
    expect(d.kind).toBe('full');
    if (d.kind === 'full') {
      expect(d.deductibleCents).toBe(475_000);
      expect(d.fmvCents).toBe(25_000);
    }
  });
  it('never reports a negative deductible amount', () => {
    const d = decideReceipt(1_000, { key: 'x', name: 'X', benefits: ['Thing'], fmvCents: 5_000 });
    if (d.kind === 'full') expect(d.deductibleCents).toBe(0);
  });
});
