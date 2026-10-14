import type { APIRoute } from 'astro';
import { addSubscriber } from '@/server/db/queries/subscribers';
import { badRequest, clientIp, json, rateLimit, readJson, route } from '@/server/http';
import { hashIp } from '@/server/refs';
import { parseOrThrow, subscribeSchema } from '@/server/schemas';

export const prerender = false;

/** Public email-list sign-up from the popup, footer, contact, and donate pages. */
export const POST: APIRoute = route(async (ctx) => {
  const raw = (await readJson<Record<string, unknown>>(ctx)) ?? {};
  // Honeypot: bots fill every field. Pretend it worked and drop it.
  if (typeof raw.website === 'string' && raw.website.trim()) return json({ ok: true }, 201);
  const ip = clientIp(ctx);
  if (!rateLimit(`subscribe:${ip ?? 'none'}`, 5, 10 * 60 * 1000))
    throw badRequest('Too many sign-ups in a row. Wait a few minutes and try again.');
  const data = parseOrThrow(subscribeSchema, raw);
  await addSubscriber({ ...data, ipHash: hashIp(ip) });
  return json({ ok: true }, 201);
});
