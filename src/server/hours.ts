import type { AppSession } from './auth/server';

/** A member logs and removes his own hours; officers can for anyone. */
export function canManageHours(session: Pick<AppSession, 'role' | 'memberId'>, memberId: string) {
  return session.role === 'admin' || session.memberId === memberId;
}

export const toMinutes = (hours: number) => Math.round(hours * 60);

/** First and last day of a calendar year, as the YYYY-MM-DD strings the date column holds. */
export function yearRange(year: number): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}
