/** Event date helpers. Times are shown in the Guild's own time zone. */
export const TIME_ZONE = 'America/Chicago';

type Dated = { start: string; end?: string };

export function splitEvents<T extends Dated>(
  events: T[],
  now: Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const t = now.getTime();
  const endOf = (e: Dated) => new Date(e.end ?? e.start).getTime();
  const upcoming = events
    .filter((e) => endOf(e) >= t)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const past = events
    .filter((e) => endOf(e) < t)
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));
  return { upcoming, past };
}

export function formatEventDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function formatEventTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

export function monthKey(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}
