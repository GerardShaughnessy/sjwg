import type { APIRoute } from 'astro';
import { db } from '@/server/db/client';
import { formSubmissions } from '@/server/db/schema';
import { sendEmail } from '@/server/email/send';
import { formNotification } from '@/server/email/templates/account';
import { recipientsFor } from '@/config/contact-routing';
import { badRequest, clientIp, json, rateLimit, readJson, route } from '@/server/http';
import { hashIp } from '@/server/refs';
import { formSchemas, parseOrThrow } from '@/server/schemas';
import { CHRISTMAS, christmasRsvps, headCount } from '@/server/rsvp/christmas';
import { eq } from 'drizzle-orm';

export const prerender = false;

function status(yes: number) {
  const closed = yes >= CHRISTMAS.capacity || Date.now() > CHRISTMAS.closesAt.getTime();
  return { yes, capacity: CHRISTMAS.capacity, left: Math.max(0, CHRISTMAS.capacity - yes), closed };
}

/** How many are coming, and whether RSVPs are still open. */
export const GET: APIRoute = route(async () => json(status(headCount(await christmasRsvps()))));

/** Yes or No. A Yes that would take the head count past capacity is refused. */
export const POST: APIRoute = route(async (ctx) => {
  const raw = (await readJson<Record<string, unknown>>(ctx)) ?? {};
  if (typeof raw.website === 'string' && raw.website.trim()) return json(status(0), 201);
  const ip = clientIp(ctx);
  if (!rateLimit(`rsvp:${ip ?? 'none'}`, 8, 10 * 60 * 1000))
    throw badRequest('Too many RSVPs in a row. Wait a few minutes and try again.');
  const data = parseOrThrow(formSchemas.rsvp, raw);
  const email = data.email.toLowerCase();
  const party = data.attending === 'yes' ? data.adults + data.children : 0;
  if (data.attending === 'no') {
    data.adults = 0;
    data.children = 0;
  }
  if (Date.now() > CHRISTMAS.closesAt.getTime())
    throw badRequest('RSVPs for the party are closed.');
  const rows = await christmasRsvps();
  // His own earlier Yes doesn't count against him when he changes it.
  const others = headCount(rows, email);
  if (party > 0 && others + party > CHRISTMAS.capacity) {
    const left = Math.max(0, CHRISTMAS.capacity - others);
    throw badRequest(
      left === 0
        ? 'Sorry, the party is full. Email hello@sjwg.org and we will add you to the waiting list.'
        : `Sorry, only ${left} ${left === 1 ? 'spot is' : 'spots are'} left. Change the number coming, or email hello@sjwg.org.`,
    );
  }
  const payload = { event: CHRISTMAS.event, ...data, email, website: undefined };
  const [row] = await db()
    .insert(formSubmissions)
    .values({ kind: 'rsvp', payload, email, name: data.name, ipHash: hashIp(ip) })
    .returning({ id: formSubmissions.id });
  const yes = others + party;
  {
    const to = recipientsFor('rsvp');
    const res = await sendEmail({
      to,
      email: formNotification('rsvp', {
        name: data.name,
        email,
        phone: data.phone,
        coming:
          data.attending === 'yes' ? `Yes: ${data.adults} adults, ${data.children} children` : 'No',
        headCountSoFar: `${yes} of ${CHRISTMAS.capacity}`,
      }),
      template: 'form-rsvp',
      replyTo: email,
      related: { type: 'form', id: row.id },
    });
    if (res.status === 'sent')
      await db()
        .update(formSubmissions)
        .set({ notifiedAt: new Date() })
        .where(eq(formSubmissions.id, row.id));
  }
  return json(status(yes), 201);
});
