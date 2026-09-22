import { describe, expect, it } from 'vitest';
import { formSchemas, issuesToFields, requestAnswersSchema } from './schemas';

const good = {
  trade: 'Plumbing',
  tradeSlug: 'plumbing',
  description: 'Water heater is leaking from the bottom and the floor is wet.',
  urgency: 'getting-worse',
  zip: '63118',
  neighborhood: '',
  contact: { name: 'Sam', phone: '(314) 555-0147', email: '', bestTime: 'Evenings' },
};

describe('requestAnswersSchema', () => {
  it('accepts a complete request', () => {
    expect(requestAnswersSchema.safeParse(good).success).toBe(true);
  });
  it('requires a phone or an email, not both', () => {
    const r = requestAnswersSchema.safeParse({ ...good, contact: { ...good.contact, phone: '' } });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(issuesToFields(r.error.issues).fields['contact.phone']).toMatch(
        /phone number or an email/,
      );
    const ok = requestAnswersSchema.safeParse({
      ...good,
      contact: { ...good.contact, phone: '', email: 'sam@example.com' },
    });
    expect(ok.success).toBe(true);
  });
  it('says what to fix for a bad zip', () => {
    const r = requestAnswersSchema.safeParse({ ...good, zip: '631' });
    expect(r.success).toBe(false);
    if (!r.success) expect(issuesToFields(r.error.issues).fields.zip).toMatch(/Five digits/);
  });
  it('allows a neighborhood instead of a zip', () => {
    expect(
      requestAnswersSchema.safeParse({ ...good, zip: '', neighborhood: 'Dutchtown' }).success,
    ).toBe(true);
  });
});

describe('formSchemas', () => {
  it('drops the honeypot when filled', () => {
    expect(
      formSchemas.contact.safeParse({ name: 'A', email: 'a@b.co', message: 'hi', website: 'spam' })
        .success,
    ).toBe(false);
    expect(
      formSchemas.contact.safeParse({ name: 'A', email: 'a@b.co', message: 'hi', website: '' })
        .success,
    ).toBe(true);
  });
  it('membership needs a phone or an email', () => {
    expect(formSchemas.membership.safeParse({ name: 'A', trade: 'Plumbing' }).success).toBe(false);
    expect(
      formSchemas.membership.safeParse({ name: 'A', trade: 'Plumbing', phone: '3145550147' })
        .success,
    ).toBe(true);
  });
});
