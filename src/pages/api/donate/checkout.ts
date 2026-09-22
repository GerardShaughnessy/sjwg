import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { badRequest, clientIp, json, rateLimit, readJson, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { createCheckout, donationsLive } from '@/server/stripe';
import { isEmail } from '@/lib/validate';

export const prerender = false;

const schema = z.object({
  amountCents: z
    .number()
    .int()
    .min(100, 'At least one dollar.')
    .max(5_000_000, 'For a gift above $50,000, please contact the Guild directly.'),
  interval: z.enum(['once', 'month']).default('once'),
  tier: z.string().trim().max(40).optional(),
  fund: z.string().trim().max(80).optional(),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || isEmail(v), 'That email does not look right.'),
});

/** Public. Creates a hosted Checkout session and returns its URL. */
export const POST: APIRoute = route(async (ctx) => {
  if (!donationsLive())
    throw badRequest('Online giving is not open yet. Give by check or in person for now.');
  if (!rateLimit(`checkout:${clientIp(ctx) ?? 'none'}`, 10, 10 * 60 * 1000))
    throw badRequest('Too many tries in a row. Wait a minute and try again.');
  const input = parseOrThrow(schema, await readJson(ctx));
  const url = await createCheckout(input);
  return json({ url });
});
