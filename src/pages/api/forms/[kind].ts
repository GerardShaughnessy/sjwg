import type { APIRoute } from 'astro';
import { db } from '@/server/db/client';
import { formSubmissions } from '@/server/db/schema';
import { sendEmail } from '@/server/email/send';
import { formNotification } from '@/server/email/templates/account';
import { env } from '@/server/env';
import { badRequest, clientIp, json, notFound, rateLimit, readJson, route } from '@/server/http';
import { hashIp } from '@/server/refs';
import { formSchemas, parseOrThrow, type FormKind } from '@/server/schemas';
import { eq } from 'drizzle-orm';

export const prerender = false;

/** Contact, partnership, and membership-interest forms. Stored, then emailed to the Guild. */
export const POST: APIRoute = route(async (ctx) => {
  const kind = ctx.params.kind as FormKind;
  const schema = formSchemas[kind];
  if (!schema) throw notFound();
  const raw = (await readJson<Record<string, unknown>>(ctx)) ?? {};
  // Honeypot: bots fill every field. Pretend it worked and drop it.
  if (typeof raw.website === 'string' && raw.website.trim()) return json({ id: 'ok' }, 201);
  const ip = clientIp(ctx);
  if (!rateLimit(`form:${kind}:${ip ?? 'none'}`, 5, 10 * 60 * 1000))
    throw badRequest('Too many messages in a row. Wait a few minutes and try again.');
  const data = parseOrThrow(schema, raw) as Record<string, string>;
  const [row] = await db()
    .insert(formSubmissions)
    .values({
      kind,
      payload: data,
      email: data.email ?? null,
      name: data.name ?? null,
      ipHash: hashIp(ip),
    })
    .returning({ id: formSubmissions.id });
  const to = env('GUILD_NOTIFY_EMAIL');
  if (to) {
    const res = await sendEmail({
      to,
      email: formNotification(kind, data),
      template: `form-${kind}`,
      replyTo: data.email,
      related: { type: 'form', id: row.id },
    });
    if (res.status === 'sent')
      await db()
        .update(formSubmissions)
        .set({ notifiedAt: new Date() })
        .where(eq(formSubmissions.id, row.id));
  }
  return json({ id: row.id }, 201);
});
