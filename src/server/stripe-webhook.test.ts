import { beforeAll, describe, expect, it } from 'vitest';
import Stripe from 'stripe';

const SECRET = 'whsec_test_secret_for_unit_tests';
process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
process.env.STRIPE_WEBHOOK_SECRET = SECRET;

const { verifyEvent } = await import('./stripe');

const payload = JSON.stringify({
  id: 'evt_test_1',
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_1',
      object: 'checkout.session',
      payment_status: 'paid',
      mode: 'payment',
      amount_total: 2500,
    },
  },
});

describe('verifyEvent', () => {
  let header: string;
  beforeAll(() => {
    header = Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  });
  it('accepts a correctly signed body', () => {
    const ev = verifyEvent(payload, header);
    expect(ev.id).toBe('evt_test_1');
    expect(ev.type).toBe('checkout.session.completed');
  });
  it('rejects a tampered body', () => {
    expect(() => verifyEvent(payload.replace('2500', '25000'), header)).toThrow(/signature/i);
  });
  it('rejects a missing signature', () => {
    expect(() => verifyEvent(payload, null)).toThrow(/signature/i);
  });
  it('rejects the wrong secret', () => {
    const other = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_other' });
    expect(() => verifyEvent(payload, other)).toThrow(/signature/i);
  });
});
