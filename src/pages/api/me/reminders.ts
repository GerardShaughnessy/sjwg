import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { eventReminderPrefs } from '@/server/db/schema';
import { json, readJson, requireSession, route } from '@/server/http';
import { parseOrThrow, reminderPrefsSchema } from '@/server/schemas';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const [row] = await db()
    .select()
    .from(eventReminderPrefs)
    .where(eq(eventReminderPrefs.userId, session.userId))
    .limit(1);
  return json({
    prefs: row
      ? { email: row.email, sms: row.sms, phone: row.phone }
      : { email: false, sms: false, phone: '' },
  });
});

export const PUT: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const prefs = parseOrThrow(reminderPrefsSchema, await readJson(ctx));
  await db()
    .insert(eventReminderPrefs)
    .values({ userId: session.userId, ...prefs, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: eventReminderPrefs.userId,
      set: { ...prefs, updatedAt: new Date() },
    });
  // SMS is stored now and sent in a later round once texting is registered.
  return json({ prefs });
});
