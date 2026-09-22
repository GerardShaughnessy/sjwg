import { describe, expect, it } from 'vitest';
import { intakeAlert, requestConfirmation } from './templates/request';
import { formNotification, memberInvitation } from './templates/account';

const r = {
  ref: 'SJWG-ABC234',
  trade: 'Plumbing',
  description: 'Leak <under> the sink & floor is wet.',
  urgency: 'no-heat-or-water',
  zip: '63118',
  neighborhood: '',
  contactName: 'Sam',
  contactPhone: '(314) 555-0147',
  contactEmail: '',
  bestTime: 'Evenings',
  photoCount: 1,
};

describe('email templates', () => {
  it('confirmation carries the reference, the tracking link, and no em dashes', () => {
    const e = requestConfirmation(r, 'tok123');
    expect(e.subject).toContain('SJWG-ABC234');
    expect(e.text).toContain('/request/track/tok123');
    expect(e.html).toContain('/request/track/tok123');
    expect(e.html).toContain('&lt;under&gt;');
    expect(e.text + e.html).not.toMatch(/—/);
  });
  it('intake alert flags urgency in the subject', () => {
    const e = intakeAlert(r, 'req-1');
    expect(e.subject).toMatch(/^Urgent:/);
    expect(intakeAlert({ ...r, urgency: 'can-wait' }, 'req-1').subject).not.toMatch(/Urgent/);
  });
  it('invitation links to the invite page', () => {
    const e = memberInvitation({ name: 'Pat', invitedBy: 'Gerard', role: 'member', token: 'abc' });
    expect(e.text).toContain('/invite/abc');
  });
  it('form notification skips the honeypot and empty fields', () => {
    const e = formNotification('contact', {
      name: 'A',
      email: 'a@b.co',
      phone: '',
      message: 'hi',
      website: '',
    });
    expect(e.text).not.toContain('Website');
    expect(e.text).not.toContain('Phone');
    expect(e.text).toContain('Message: hi');
  });
});

describe('donation receipt tax wording', async () => {
  const { donationAcknowledgment } = await import('./templates/donation');
  const gift = {
    donorName: 'A',
    amountCents: 10_000,
    receivedAt: new Date('2026-09-22T12:00:00Z'),
    recurring: false,
    fmvCents: 0,
    deductibleCents: 10_000,
    benefits: [],
    tierName: null,
  };
  it('says the application is pending unless ORG_TAX_STATUS is determined', () => {
    delete process.env.ORG_TAX_STATUS;
    const e = donationAcknowledgment(gift);
    expect(e.text).toMatch(/application is pending/);
    expect(e.text).not.toMatch(/is a 501\(c\)\(3\) nonprofit organization/);
    process.env.ORG_TAX_STATUS = 'determined';
    expect(donationAcknowledgment(gift).text).toMatch(/is a 501\(c\)\(3\) nonprofit organization/);
    delete process.env.ORG_TAX_STATUS;
  });
});
