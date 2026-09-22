import { describe, expect, it } from 'vitest';
import { chicagoDate, selectReminders, tomorrowInChicago } from './reminders';

const users = [
  { userId: 'u1', email: 'a@example.com', wantsEmail: true, disabled: false },
  { userId: 'u2', email: 'b@example.com', wantsEmail: false, disabled: false },
  { userId: 'u3', email: 'c@example.com', wantsEmail: true, disabled: true },
];

describe('chicago dates', () => {
  it('uses the Guild clock, not UTC', () => {
    // 03:30 UTC on Oct 4 is still Oct 3 in Chicago (CDT).
    expect(chicagoDate(new Date('2026-10-04T03:30:00Z'))).toBe('2026-10-03');
    expect(tomorrowInChicago(new Date('2026-10-04T03:30:00Z'))).toBe('2026-10-04');
  });
  it('crosses the DST change without skipping a day', () => {
    // Fall back happens 2026-11-01 in the US. 14:00 UTC on Oct 31 -> tomorrow is Nov 1.
    expect(tomorrowInChicago(new Date('2026-10-31T14:00:00Z'))).toBe('2026-11-01');
    expect(tomorrowInChicago(new Date('2026-11-01T14:00:00Z'))).toBe('2026-11-02');
    // Spring forward 2026-03-08.
    expect(tomorrowInChicago(new Date('2026-03-07T14:00:00Z'))).toBe('2026-03-08');
  });
});

describe('selectReminders', () => {
  const now = new Date('2026-10-02T14:00:00Z'); // 9 AM Chicago on Oct 2
  const events = [
    { id: 'e-tomorrow', start: new Date('2026-10-03T08:00:00-05:00'), published: true },
    { id: 'e-late-tomorrow', start: new Date('2026-10-03T23:30:00-05:00'), published: true },
    { id: 'e-today', start: new Date('2026-10-02T19:00:00-05:00'), published: true },
    { id: 'e-draft', start: new Date('2026-10-03T10:00:00-05:00'), published: false },
    { id: 'e-next-week', start: new Date('2026-10-10T10:00:00-05:00'), published: true },
  ];
  it('picks only published events happening tomorrow, for users who opted in', () => {
    const out = selectReminders({ events, users, sent: [], now });
    expect(out).toEqual([
      { eventId: 'e-tomorrow', userId: 'u1' },
      { eventId: 'e-late-tomorrow', userId: 'u1' },
    ]);
  });
  it('never sends twice', () => {
    const out = selectReminders({
      events,
      users,
      sent: [{ eventId: 'e-tomorrow', userId: 'u1' }],
      now,
    });
    expect(out).toEqual([{ eventId: 'e-late-tomorrow', userId: 'u1' }]);
  });
});
