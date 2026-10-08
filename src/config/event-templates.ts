import type { EventKind } from '@/lib/types';

/**
 * Starting points for the portal's "New event" form. Picking one fills the
 * form with the Guild's usual time, place, and wording, and suggests the next
 * date that follows the rule. Officers can change anything before saving.
 */
export const GUILD_LOCATION = 'St. Mary of Victories Catholic Church, 744 S Third St, St. Louis';

/** When the event usually happens. Times are Central, 24-hour "HH:MM". */
export type DateRule =
  | { nth: number; weekday: number } // nth weekday of the month (weekday: 0 = Sunday ... 6 = Saturday)
  | { month: number; day: number } // a fixed day each year (month: 1 to 12)
  | { weekday: number } // the next such weekday
  | null; // no usual date: officer picks one

export type EventTemplate = {
  key: string;
  label: string;
  title: string;
  kind: EventKind;
  rule: DateRule;
  startTime: string;
  endTime: string;
  location: string;
  summary: string;
  body: string;
  membersOnly: boolean;
};

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    key: 'meeting',
    label: 'Guild Meeting (first Thursday, 7:00 PM)',
    title: 'Guild Meeting',
    kind: 'meeting',
    rule: { nth: 1, weekday: 4 },
    startTime: '19:00',
    endTime: '20:30',
    location: GUILD_LOCATION,
    summary:
      'The monthly Guild meeting: formation, prayer, and Guild business. Men interested in joining are welcome.',
    body: 'The Guild meets the first Thursday of every month. Formation in the Catholic faith and the dignity of work, prayer, and Guild business. Men discerning membership are welcome to come and see.',
    membersOnly: false,
  },
  {
    key: 'holy_hour',
    label: 'Guild Holy Hour (third Thursday, 7:00 PM)',
    title: 'Guild Holy Hour',
    kind: 'holy_hour',
    rule: { nth: 3, weekday: 4 },
    startTime: '19:00',
    endTime: '20:00',
    location: GUILD_LOCATION,
    summary:
      'An hour of prayer before the Blessed Sacrament for the Guild, its families, and its benefactors.',
    body: "The Guild keeps a holy hour the third Thursday of every month. Donors' names and prayer intentions are offered on request. All are welcome.",
    membersOnly: false,
  },
  {
    key: 'mass',
    label: 'Sunday Mass at St. Mary of Victories (third Sunday, 11:00 AM)',
    title: 'Sunday Mass at St. Mary of Victories',
    kind: 'mass',
    rule: { nth: 3, weekday: 0 },
    startTime: '11:00',
    endTime: '12:00',
    location: GUILD_LOCATION,
    summary: 'Sunday Mass at St. Mary of Victories, offered the third Sunday of each month.',
    body: 'St. Mary of Victories offers Sunday Mass at 11:00 AM on the third Sunday of each month, with elements of Latin and Hungarian. Guild members and families are encouraged to attend together.',
    membersOnly: false,
  },
  {
    key: 'workday',
    label: 'Parish Work Day (Saturday, 8:00 AM)',
    title: 'Parish Work Day',
    kind: 'workday',
    rule: { weekday: 6 },
    startTime: '08:00',
    endTime: '14:00',
    location: GUILD_LOCATION,
    summary: 'A day of donated labor for the parish. Tradesmen and helpers welcome.',
    body: 'Guild members and volunteers give a day of work to the parish. Bring gloves and your tools if you have a trade; there is work for helpers too. Counts toward members’ service hours.',
    membersOnly: false,
  },
  {
    key: 'christmas',
    label: 'Guild Christmas Party (after the December third-Sunday Mass)',
    title: 'Guild Christmas Party',
    kind: 'party',
    rule: { nth: 3, weekday: 0 }, // the code picks December
    startTime: '12:15',
    endTime: '14:30',
    location: GUILD_LOCATION,
    summary: 'After the 11:00 AM Mass at St. Mary of Victories. Guild members, families, and friends.',
    body: 'Join the Guild after the 11:00 AM Sunday Mass for the Christmas party. Members, families, and friends are welcome.',
    membersOnly: false,
  },
  {
    key: 'procession',
    label: 'St. Joseph the Worker Procession (May 1)',
    title: 'St. Joseph the Worker Procession',
    kind: 'procession',
    rule: { month: 5, day: 1 },
    startTime: '18:00',
    endTime: '19:30',
    location: GUILD_LOCATION,
    summary: 'The Guild’s procession on the feast of its patron, St. Joseph the Worker.',
    body: 'On the feast of St. Joseph the Worker, the Guild processes with the statue of St. Joseph and closes with Benediction. All are welcome.',
    membersOnly: false,
  },
  {
    key: 'retreat',
    label: "Annual Tradesmen's Retreat (pick the dates)",
    title: "Annual Tradesmen's Retreat",
    kind: 'retreat',
    rule: null,
    startTime: '18:00',
    endTime: '12:00',
    location: '',
    summary: 'The Guild’s annual retreat for tradesmen.',
    body: 'A weekend of prayer, talks, and fraternity for Guild members. Details to follow.',
    membersOnly: true,
  },
];

/** The next date (YYYY-MM-DD, Central) that follows a template's rule, on or after `from`. */
export function nextDate(t: EventTemplate, from: Date = new Date()): string | null {
  const rule = t.rule;
  if (!rule) return null;
  const today = new Date(from.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  today.setHours(0, 0, 0, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if ('month' in rule) {
    let d = new Date(today.getFullYear(), rule.month - 1, rule.day);
    if (d < today) d = new Date(today.getFullYear() + 1, rule.month - 1, rule.day);
    return fmt(d);
  }
  if ('nth' in rule) {
    const nthIn = (y: number, m: number) => {
      const first = new Date(y, m, 1);
      const offset = (rule.weekday - first.getDay() + 7) % 7;
      return new Date(y, m, 1 + offset + (rule.nth - 1) * 7);
    };
    for (let i = 0; i < 24; i++) {
      const y = today.getFullYear() + Math.floor((today.getMonth() + i) / 12);
      const m = (today.getMonth() + i) % 12;
      if (t.key === 'christmas' && m !== 11) continue;
      const d = nthIn(y, m);
      if (d >= today) return fmt(d);
    }
    return null;
  }
  const d = new Date(today);
  d.setDate(d.getDate() + ((rule.weekday - d.getDay() + 7) % 7));
  return fmt(d);
}
