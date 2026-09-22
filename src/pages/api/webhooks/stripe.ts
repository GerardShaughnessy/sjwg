import type { APIRoute } from 'astro';
import { json } from '@/server/http';
import { HttpError } from '@/server/http';
import { handleStripeEvent, verifyEvent } from '@/server/stripe';

export const prerender = false;

/**
 * The only writer of card gifts. Signature verified on the raw body;
 * duplicates short-circuit on the stripe_events table; a thrown error returns
 * 500 so Stripe retries.
 */
export const POST: APIRoute = async (ctx) => {
  let event;
  try {
    event = verifyEvent(await ctx.request.text(), ctx.request.headers.get('stripe-signature'));
  } catch (err) {
    if (err instanceof HttpError) return err.toResponse();
    return json({ error: 'Bad request.' }, 400);
  }
  try {
    const outcome = await handleStripeEvent(event);
    return json({ received: true, outcome });
  } catch (err) {
    console.error('[stripe] webhook failed', event.id, err);
    return json({ error: 'Handler failed; Stripe will retry.' }, 500);
  }
};
