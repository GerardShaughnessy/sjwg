/**
 * Pure selection for the daily reminder job: which (event, user) pairs get an
 * email today. "Tomorrow" is measured on the Guild's clock (America/Chicago),
 * so DST does not shift which day an event lands on.
 */
export const TIME_ZONE = 'America/Chicago';

export interface ReminderEvent {
  id: string;
  start: Date;
  published: boolean;
}
export interface ReminderUser {
  userId: string;
  email: string;
  wantsEmail: boolean;
  disabled: boolean;
}
export interface SentKey {
  eventId: string;
  userId: string;
}

export function chicagoDate(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** The calendar date (in Chicago) one day after `now`. */
export function tomorrowInChicago(now: Date): string {
  // Add 24h then take the Chicago date; DST days differ by an hour but never by a day.
  return chicagoDate(new Date(now.getTime() + 24 * 3600 * 1000));
}

export function selectReminders(input: {
  events: ReminderEvent[];
  users: ReminderUser[];
  sent: SentKey[];
  now: Date;
}): { eventId: string; userId: string }[] {
  const target = tomorrowInChicago(input.now);
  const sentSet = new Set(input.sent.map((s) => `${s.eventId}:${s.userId}`));
  const out: { eventId: string; userId: string }[] = [];
  for (const e of input.events) {
    if (!e.published || chicagoDate(e.start) !== target) continue;
    for (const u of input.users) {
      if (!u.wantsEmail || u.disabled || !u.email) continue;
      if (sentSet.has(`${e.id}:${u.userId}`)) continue;
      out.push({ eventId: e.id, userId: u.userId });
    }
  }
  return out;
}
