import { describe, expect, it } from 'vitest';
import { EVENT_TEMPLATES, nextDate } from './event-templates';

const t = (k: string) => EVENT_TEMPLATES.find((x) => x.key === k)!;
const oct8 = new Date('2026-10-08T15:00:00Z');

describe('event template dates', () => {
  it('finds the next first and third Thursday', () => {
    expect(nextDate(t('meeting'), oct8)).toBe('2026-11-05');
    expect(nextDate(t('holy_hour'), oct8)).toBe('2026-10-15');
    expect(nextDate(t('holy_hour'), new Date('2026-10-16T15:00:00Z'))).toBe('2026-11-19');
  });
  it('finds the third Sunday, the December party, May 1, and the next Saturday', () => {
    expect(nextDate(t('mass'), oct8)).toBe('2026-10-18');
    expect(nextDate(t('christmas'), oct8)).toBe('2026-12-20');
    expect(nextDate(t('procession'), oct8)).toBe('2027-05-01');
    expect(nextDate(t('workday'), oct8)).toBe('2026-10-10');
  });
  it('leaves the retreat for the officer to pick', () => {
    expect(nextDate(t('retreat'), oct8)).toBeNull();
  });
});
