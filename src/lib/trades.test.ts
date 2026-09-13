import { describe, it, expect } from 'vitest';
import { getTrades, getAreas, slugify, tradeFromSlug, NOT_SURE } from './trades';

const members = [
  { trade: 'Plumbing', areas: ['St. Louis city', 'South County'] },
  { trade: 'Electrical', areas: ['North County'] },
  { trade: 'Plumbing', areas: ['St. Louis city'] },
  { trade: 'HVAC', areas: ['West County'] },
];

describe('trades', () => {
  it('lists unique trades alphabetically', () => {
    expect(getTrades(members)).toEqual(['Electrical', 'HVAC', 'Plumbing']);
  });
  it('lists unique areas alphabetically', () => {
    expect(getAreas(members)).toEqual([
      'North County',
      'South County',
      'St. Louis city',
      'West County',
    ]);
  });
  it('slugifies trade names', () => {
    expect(slugify('General repair')).toBe('general-repair');
    expect(slugify('HVAC')).toBe('hvac');
    expect(slugify(NOT_SURE)).toBe('not-sure');
  });
  it('maps a slug back to a trade, including not-sure, and ignores unknowns', () => {
    const trades = getTrades(members);
    expect(tradeFromSlug(trades, 'plumbing')).toBe('Plumbing');
    expect(tradeFromSlug(trades, 'not-sure')).toBe(NOT_SURE);
    expect(tradeFromSlug(trades, 'welding')).toBeNull();
    expect(tradeFromSlug(trades, null)).toBeNull();
  });
});
