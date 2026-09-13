import { describe, it, expect } from 'vitest';
import { splitEvents, formatEventDate, formatEventTime } from './events';

const ev = (id: string, start: string, end?: string) => ({ id, start, end });

describe('events', () => {
  it('splits into upcoming ascending and past descending', () => {
    const now = new Date('2026-09-13T12:00:00-05:00');
    const list = [
      ev('a', '2026-05-01T18:00:00-05:00'),
      ev('b', '2026-12-12T18:00:00-06:00'),
      ev('c', '2026-10-03T08:00:00-05:00'),
      ev('d', '2026-01-10T08:00:00-06:00'),
    ];
    const { upcoming, past } = splitEvents(list, now);
    expect(upcoming.map((e) => e.id)).toEqual(['c', 'b']);
    expect(past.map((e) => e.id)).toEqual(['a', 'd']);
  });
  it('keeps a multi-day event upcoming until its end passes', () => {
    const now = new Date('2027-02-20T12:00:00-06:00');
    const { upcoming } = splitEvents(
      [ev('r', '2027-02-19T17:00:00-06:00', '2027-02-21T13:00:00-06:00')],
      now,
    );
    expect(upcoming).toHaveLength(1);
  });
  it('formats dates and times in Central time', () => {
    expect(formatEventDate('2026-10-03T08:00:00-05:00')).toBe('Saturday, October 3, 2026');
    expect(formatEventTime('2026-10-03T08:00:00-05:00')).toBe('8:00 AM');
  });
});
