import Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import { db } from './db/client';
import { donations, givingTiers, stripeEvents } from './db/schema';
import { upsertDonor } from './db/queries/donations';
import { env, requireEnv, siteUrl } from './env';
import { HttpError } from './http';
import { decideReceipt, tierForAmount } from './receipts';
import { sendEmail } from './email/send';
import {
  donationAcknowledgment,
  donationThankYou,
  paymentFailedNotice,
} from './email/templates/donation';
import { GIVING_LEVELS, SITE_NAME } from '@/config/site';
import { isUniqueViolation } from './refs';

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client)
    client = new Stripe(requireEnv('STRIPE_SECRET_KEY'), { apiVersion: '2026-08-26.dahlia' });
  return client;
}

export const donationsLive = () =>
  env('DONATIONS_LIVE') === 'true' && Boolean(env('STRIPE_SECRET_KEY'));

export interface CheckoutInput {
  amountCents: number;
  interval: 'once' | 'month';
  tier?: string;
  fund?: string;
  email?: string;
}

const INTEGRATION_ID = 'sjwg-give-form-qwlzmvxb';

/** Hosted Checkout. Card fields never touch our page. */
export async function createCheckout(input: CheckoutInput): Promise<string> {
  const level = GIVING_LEVELS.find((g) => g.key === input.tier) ?? null;
  const name = level ? `Gift to ${SITE_NAME} (${level.name} level)` : `Gift to ${SITE_NAME}`;
  const metadata = {
    tier: level?.key ?? '',
    fund: input.fund ?? 'general',
    interval: input.interval,
    source: 'sjwg-web',
  };
  const base = siteUrl();
  const recurring = input.interval === 'month';
  const session = await stripe().checkout.sessions.create({
    mode: recurring ? 'subscription' : 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: input.amountCents,
          product_data: { name },
          ...(recurring ? { recurring: { interval: 'month' } } : {}),
        },
      },
    ],
    ...(recurring
      ? { subscription_data: { metadata } }
      : { submit_type: 'donate', customer_creation: 'always' }),
    customer_email: input.email || undefined,
    billing_address_collection: 'auto',
    metadata,
    success_url: `${base}/donate/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/donate?cancelled=1#give`,
    integration_identifier: INTEGRATION_ID,
  } as Stripe.Checkout.SessionCreateParams);
  if (!session.url)
    throw new HttpError(502, 'Stripe did not return a checkout page. Try again in a minute.');
  return session.url;
}

/** For the thank-you page. Reads only; the webhook is the single writer. */
export async function describeSession(sessionId: string) {
  const s = await stripe().checkout.sessions.retrieve(sessionId);
  return {
    amountCents: s.amount_total ?? 0,
    email: s.customer_details?.email ?? s.customer_email ?? null,
    recurring: s.mode === 'subscription',
    paid: s.payment_status === 'paid' || s.mode === 'subscription',
  };
}

/* ---------------------------------------------------------------- webhook */

export function verifyEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (!signature) throw new HttpError(400, 'Missing Stripe signature.');
  try {
    return stripe().webhooks.constructEvent(
      rawBody,
      signature,
      requireEnv('STRIPE_WEBHOOK_SECRET'),
    );
  } catch (err) {
    throw new HttpError(400, `Webhook signature failed: ${(err as Error).message}`);
  }
}

/** Idempotency: returns false when this event id was already recorded. */
async function claimEvent(event: Stripe.Event): Promise<boolean> {
  const rows = await db()
    .insert(stripeEvents)
    .values({
      id: event.id,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: stripeEvents.id });
  return rows.length > 0;
}

async function finishEvent(id: string, error?: string) {
  await db()
    .update(stripeEvents)
    .set({ processedAt: new Date(), error: error ?? null })
    .where(eq(stripeEvents.id, id));
}

export async function handleStripeEvent(
  event: Stripe.Event,
): Promise<'processed' | 'duplicate' | 'ignored'> {
  if (!(await claimEvent(event))) return 'duplicate';
  try {
    let handled = false;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        handled = await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        handled = await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
      case 'checkout.session.async_payment_failed':
        await onPaymentFailed(event);
        handled = true;
        break;
      default:
        handled = false;
    }
    await finishEvent(event.id);
    return handled ? 'processed' : 'ignored';
  } catch (err) {
    await finishEvent(event.id, (err as Error).message);
    throw err;
  }
}

function metaOf(obj: { metadata?: Stripe.Metadata | null }) {
  const m = obj.metadata ?? {};
  return { tier: m.tier || null, fund: m.fund || 'general', interval: m.interval || 'once' };
}

const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === 'string' ? v : (v?.id ?? null);

async function onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<boolean> {
  const email = session.customer_details?.email ?? session.customer_email ?? null;
  const name = session.customer_details?.name ?? email ?? 'Online donor';
  const donor = await upsertDonor({ name, email, stripeCustomerId: idOf(session.customer) });
  if (session.mode === 'subscription') {
    // The first charge arrives as invoice.paid; record nothing here.
    return true;
  }
  if (session.payment_status !== 'paid') return true; // async method still pending
  const meta = metaOf(session);
  const amount = session.amount_total ?? 0;
  const tierKey = meta.tier || tierForAmount(amount)?.key || null;
  return recordGift({
    donorId: donor.id,
    donorName: name,
    donorEmail: email,
    amountCents: amount,
    tierKey,
    fund: meta.fund,
    recurring: false,
    receivedAt: new Date((session.created ?? Date.now() / 1000) * 1000),
    stripe: {
      checkoutSessionId: session.id,
      paymentIntentId: idOf(session.payment_intent),
      invoiceId: null,
      subscriptionId: null,
    },
  });
}

async function onInvoicePaid(invoice: Stripe.Invoice): Promise<boolean> {
  const sub = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  const parent = (
    invoice as unknown as {
      parent?: {
        subscription_details?: {
          subscription?: string | { id: string };
          metadata?: Stripe.Metadata;
        };
      };
    }
  ).parent;
  const subscriptionId = idOf(sub) ?? idOf(parent?.subscription_details?.subscription);
  const metadata =
    parent?.subscription_details?.metadata ?? invoice.lines?.data?.[0]?.metadata ?? {};
  const meta = metaOf({ metadata });
  const email = invoice.customer_email ?? null;
  const name = invoice.customer_name ?? email ?? 'Online donor';
  const donor = await upsertDonor({ name, email, stripeCustomerId: idOf(invoice.customer) });
  const amount = invoice.amount_paid ?? 0;
  if (amount <= 0) return true;
  const tierKey = meta.tier || tierForAmount(amount)?.key || null;
  return recordGift({
    donorId: donor.id,
    donorName: name,
    donorEmail: email,
    amountCents: amount,
    tierKey,
    fund: meta.fund,
    recurring: true,
    receivedAt: new Date((invoice.status_transitions?.paid_at ?? invoice.created) * 1000),
    stripe: {
      checkoutSessionId: null,
      paymentIntentId: null,
      invoiceId: invoice.id ?? null,
      subscriptionId,
    },
  });
}

async function onPaymentFailed(event: Stripe.Event) {
  const to = env('GUILD_NOTIFY_EMAIL');
  if (!to) return;
  const obj = event.data.object as {
    customer_email?: string | null;
    amount_due?: number;
    amount_total?: number;
  };
  await sendEmail({
    to,
    email: paymentFailedNotice({
      email: obj.customer_email ?? null,
      amountCents: obj.amount_due ?? obj.amount_total ?? 0,
      eventType: event.type,
    }),
    template: 'payment-failed',
    related: { type: 'stripe_event', id: event.id },
  });
}

interface GiftInput {
  donorId: string;
  donorName: string;
  donorEmail: string | null;
  amountCents: number;
  tierKey: string | null;
  fund: string;
  recurring: boolean;
  receivedAt: Date;
  stripe: {
    checkoutSessionId: string | null;
    paymentIntentId: string | null;
    invoiceId: string | null;
    subscriptionId: string | null;
  };
}

/** Insert the gift (unique on Stripe ids), then email the right acknowledgment. */
async function recordGift(g: GiftInput): Promise<boolean> {
  const d = db();
  const tier = g.tierKey
    ? ((await d.select().from(givingTiers).where(eq(givingTiers.key, g.tierKey)).limit(1))[0] ??
      null)
    : null;
  const decision = decideReceipt(
    g.amountCents,
    tier
      ? { key: tier.key, name: tier.name, benefits: tier.benefits, fmvCents: tier.fmvCents }
      : null,
  );
  let row;
  try {
    [row] = await d
      .insert(donations)
      .values({
        donorId: g.donorId,
        donorName: g.donorName,
        donorEmail: g.donorEmail,
        amountCents: g.amountCents,
        method: 'card',
        fund: g.fund,
        tier: g.tierKey,
        recurring: g.recurring,
        interval: g.recurring ? 'month' : null,
        receivedAt: g.receivedAt.toISOString().slice(0, 10),
        stripeCheckoutSessionId: g.stripe.checkoutSessionId,
        stripePaymentIntentId: g.stripe.paymentIntentId,
        stripeInvoiceId: g.stripe.invoiceId,
        stripeSubscriptionId: g.stripe.subscriptionId,
        fmvCents: decision.kind === 'full' ? decision.fmvCents : null,
        deductibleCents: decision.kind === 'full' ? decision.deductibleCents : null,
        ackStatus: decision.kind === 'full' ? 'pending_review' : 'pending_review',
      })
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) return true; // already recorded by an earlier delivery
    throw err;
  }

  if (g.donorEmail) {
    const email =
      decision.kind === 'full'
        ? donationAcknowledgment({
            donorName: g.donorName,
            amountCents: g.amountCents,
            receivedAt: g.receivedAt,
            recurring: g.recurring,
            fmvCents: decision.fmvCents,
            deductibleCents: decision.deductibleCents,
            benefits: decision.benefits,
            tierName: tier?.name ?? null,
          })
        : donationThankYou({
            donorName: g.donorName,
            amountCents: g.amountCents,
            recurring: g.recurring,
            tierName: tier?.name ?? null,
          });
    const res = await sendEmail({
      to: g.donorEmail,
      email,
      template: decision.kind === 'full' ? 'donation-acknowledgment' : 'donation-thank-you',
      related: { type: 'donation', id: row.id },
    });
    await d
      .update(donations)
      .set(
        decision.kind === 'full' && res.status === 'sent'
          ? { ackStatus: 'sent', ackSentAt: new Date() }
          : { ackStatus: 'pending_review' },
      )
      .where(and(eq(donations.id, row.id)));
  }
  return true;
}
