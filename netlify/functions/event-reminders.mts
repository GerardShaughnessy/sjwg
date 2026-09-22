import type { Config } from '@netlify/functions';
import { eq } from 'drizzle-orm';
import { db } from '../../src/server/db/client';
import {
  appUsers,
  eventReminderPrefs,
  eventRemindersSent,
  events,
} from '../../src/server/db/schema';
import { selectReminders } from '../../src/server/reminders';
import { sendEmail } from '../../src/server/email/send';
import { eventReminder } from '../../src/server/email/templates/donation';

/**
 * Daily. Emails members who opted in about tomorrow's events. The sent row is
 * written before the email so a re-run cannot double-send.
 */
export default async () => {
  const d = db();
  const now = new Date();
  const [evs, prefs, sent] = await Promise.all([
    d.select().from(events),
    d
      .select({
        userId: eventReminderPrefs.userId,
        wantsEmail: eventReminderPrefs.email,
        email: appUsers.email,
        disabled: appUsers.disabled,
      })
      .from(eventReminderPrefs)
      .innerJoin(appUsers, eq(appUsers.id, eventReminderPrefs.userId)),
    d
      .select({ eventId: eventRemindersSent.eventId, userId: eventRemindersSent.userId })
      .from(eventRemindersSent),
  ]);
  const picks = selectReminders({
    events: evs.map((e) => ({ id: e.id, start: e.start, published: e.published })),
    users: prefs.map((p) => ({
      userId: p.userId,
      email: p.email,
      wantsEmail: p.wantsEmail,
      disabled: p.disabled,
    })),
    sent,
    now,
  });
  let sentCount = 0;
  for (const pick of picks) {
    const ev = evs.find((e) => e.id === pick.eventId)!;
    const user = prefs.find((p) => p.userId === pick.userId)!;
    const claimed = await d
      .insert(eventRemindersSent)
      .values({ eventId: ev.id, userId: user.userId, channel: 'email' })
      .onConflictDoNothing()
      .returning({ eventId: eventRemindersSent.eventId });
    if (claimed.length === 0) continue;
    const res = await sendEmail({
      to: user.email,
      email: eventReminder({
        title: ev.title,
        start: ev.start,
        location: ev.location,
        slug: ev.slug,
        membersOnly: ev.membersOnly,
      }),
      template: 'event-reminder',
      related: { type: 'event', id: ev.id },
    });
    if (res.status === 'sent') sentCount++;
  }
  const summary = `[event-reminders] ${picks.length} due, ${sentCount} sent`;
  console.log(summary);
  return new Response(summary);
};

export const config: Config = { schedule: '0 14 * * *' };
