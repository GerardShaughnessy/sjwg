import { describe, expect, it } from 'vitest';
import { canManageHours, toMinutes, yearRange } from './hours';
import { serviceHoursSchema } from './schemas';

const MINE = '11111111-1111-4111-8111-111111111111';
const HIS = '22222222-2222-4222-8222-222222222222';

describe('who can log hours', () => {
  it('a member only for his own entry', () => {
    expect(canManageHours({ role: 'member', memberId: MINE }, MINE)).toBe(true);
    expect(canManageHours({ role: 'member', memberId: MINE }, HIS)).toBe(false);
    expect(canManageHours({ role: 'member', memberId: null }, HIS)).toBe(false);
  });
  it('an officer for anyone, linked or not', () => {
    expect(canManageHours({ role: 'admin', memberId: MINE }, HIS)).toBe(true);
    expect(canManageHours({ role: 'admin', memberId: null }, HIS)).toBe(true);
  });
});

describe('hours validation', () => {
  const ok = { workDate: '2026-10-03', hours: 4, description: ' Parish work day ' };
  it('accepts quarter hours and trims the description', () => {
    expect(serviceHoursSchema.parse({ ...ok, hours: 2.75 })).toMatchObject({
      hours: 2.75,
      description: 'Parish work day',
    });
  });
  it('rejects odd amounts, future dates, and a missing description', () => {
    expect(serviceHoursSchema.safeParse({ ...ok, hours: 0 }).success).toBe(false);
    expect(serviceHoursSchema.safeParse({ ...ok, hours: 1.1 }).success).toBe(false);
    expect(serviceHoursSchema.safeParse({ ...ok, hours: 25 }).success).toBe(false);
    expect(serviceHoursSchema.safeParse({ ...ok, workDate: '2999-01-01' }).success).toBe(false);
    expect(serviceHoursSchema.safeParse({ ...ok, workDate: '10/3/2026' }).success).toBe(false);
    expect(serviceHoursSchema.safeParse({ ...ok, description: '' }).success).toBe(false);
  });
  it('stores minutes and bounds a year', () => {
    expect(toMinutes(2.75)).toBe(165);
    expect(yearRange(2026)).toEqual(['2026-01-01', '2026-12-31']);
  });
});
