import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { appUsers } from '@/server/db/schema';
import { json, readJson, requireRole, route } from '@/server/http';
import { announcementSchema, parseOrThrow } from '@/server/schemas';
import { sendEmail } from '@/server/email/send';
import { announcement } from '@/server/email/templates/request';

export const prerender = false;

/** Officers email every member who has an account. One send per member, each logged. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireRole(ctx, 'admin');
  const input = parseOrThrow(announcementSchema, await readJson(ctx));
  const recipients = await db()
    .select({ email: appUsers.email, name: appUsers.name })
    .from(appUsers)
    .where(eq(appUsers.disabled, false));
  const email = announcement({ subject: input.subject, body: input.body, from: session.name });
  let sent = 0;
  const failed: string[] = [];
  for (const r of recipients) {
    const res = await sendEmail({
      to: r.email,
      email,
      template: 'announcement',
      related: { type: 'announcement', id: session.userId },
    });
    if (res.status === 'sent') sent++;
    else failed.push(`${r.email}: ${res.error}`);
  }
  return json({ recipients: recipients.length, sent, failed });
});
