import { PARISH_CITY, PARISH_NAME, SITE_NAME, TK } from '@/config/site';
import { env } from '../../env';
import { dollars } from '../../receipts';
import { escapeHtml, paragraphs, shell, textFooter, type Email } from '../layout';

const legalName = () => env('ORG_LEGAL_NAME') ?? SITE_NAME;
const ein = () => env('ORG_EIN') ?? '';
/** 'determined' once the IRS letter is in hand; anything else means pending. */
const taxDetermined = () => env('ORG_TAX_STATUS') === 'determined';

function taxStatusLine(): string {
  const org = legalName();
  if (taxDetermined()) {
    return `${org} is a 501(c)(3) nonprofit organization${ein() ? `, EIN ${ein()}` : ''}. Keep this letter for your records; it is your receipt for tax purposes.`;
  }
  return `${org} has applied to the IRS for recognition as a 501(c)(3) organization and that application is pending${ein() ? ` (EIN ${ein()})` : ''}. Keep this letter for your records and ask your tax advisor about deductibility; if recognition is granted retroactively, this receipt documents the gift.`;
}

function dateLine(d: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Chicago',
  }).format(d);
}

/**
 * Full receipt with the substantiation language the IRS expects (Pub. 1771):
 * legal name, EIN, 501(c)(3) statement, date, amount, and either "no goods or
 * services" or the fair market value of what the donor received.
 */
export function donationAcknowledgment(o: {
  donorName: string;
  amountCents: number;
  receivedAt: Date;
  recurring: boolean;
  fmvCents: number;
  deductibleCents: number;
  benefits: readonly string[];
  tierName: string | null;
}): Email {
  const org = legalName();
  const excess = taxDetermined()
    ? `Only the portion of your contribution above that value, ${dollars(o.deductibleCents)}, is deductible for federal income tax purposes.`
    : `The portion of your contribution above that value is ${dollars(o.deductibleCents)}.`;
  const gs =
    o.fmvCents > 0
      ? `In return for this gift you received the following, with a good-faith estimate of their fair market value of ${dollars(o.fmvCents)}: ${o.benefits.join('; ')}. ${excess}`
      : 'No goods or services were provided in exchange for this contribution.';
  const body = `${o.donorName},

Thank you. ${org} received your ${o.recurring ? 'monthly ' : ''}gift of ${dollars(o.amountCents)} on ${dateLine(o.receivedAt)}${o.tierName ? ` at the ${o.tierName} level` : ''}.

${gs}

${taxStatusLine()}

Your gift funds parish repair days, medical costs for underinsured tradesmen, emergency home maintenance for families with no one else to call, and training for men entering the trades. You will be remembered by name at the Guild's Masses and Holy Hours.`;
  const footer = `${org}. ${PARISH_NAME}, ${PARISH_CITY}. Mailing address: ${TK.mailingAddress.sample}.`;
  return {
    subject: `Receipt for your gift to ${SITE_NAME}`,
    text: `${body}\n\n${footer}${textFooter()}`,
    html: shell({
      title: 'Thank you for your gift',
      bodyHtml: paragraphs(body),
      footerNote: footer,
    }),
  };
}

/** Sent when benefits apply but their value is not yet set; the formal receipt follows by hand. */
export function donationThankYou(o: {
  donorName: string;
  amountCents: number;
  recurring: boolean;
  tierName: string | null;
}): Email {
  const body = `${o.donorName},

Thank you. ${legalName()} received your ${o.recurring ? 'monthly ' : ''}gift of ${dollars(o.amountCents)}${o.tierName ? ` at the ${o.tierName} level` : ''}.

Because this level includes things made by Guild members and work done at your home, your formal tax receipt will state their value. A Guild officer will send it to you separately.

You will be remembered by name at the Guild's Masses and Holy Hours.`;
  return {
    subject: `Thank you for your gift to ${SITE_NAME}`,
    text: `${body}${textFooter()}`,
    html: shell({ title: 'Thank you for your gift', bodyHtml: paragraphs(body) }),
  };
}

export function paymentFailedNotice(o: {
  email: string | null;
  amountCents: number;
  eventType: string;
}): Email {
  const body = `A card payment to the Guild failed.

Donor: ${o.email ?? 'unknown'}
Amount: ${dollars(o.amountCents)}
Stripe event: ${o.eventType}

Stripe retries recurring gifts on its own and emails the donor. Nothing to do unless it keeps failing; then check the Stripe dashboard.`;
  return {
    subject: `Payment failed: ${dollars(o.amountCents)}${o.email ? ` from ${o.email}` : ''}`,
    text: `${body}${textFooter()}`,
    html: shell({ title: 'A payment failed', bodyHtml: paragraphs(body) }),
  };
}

export function eventReminder(o: {
  title: string;
  start: Date;
  location: string;
  slug: string;
  membersOnly: boolean;
}): Email {
  const when = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Chicago',
  }).format(o.start);
  const link = `${(env('PUBLIC_SITE_URL') ?? 'https://sjwg.netlify.app').replace(/\/$/, '')}/events/${o.slug}`;
  const body = `Tomorrow: ${o.title}.

${when}, at ${o.location}. ${o.membersOnly ? 'Members and families.' : 'Open to all.'}

Details: ${link}

You get this because you turned on reminders in the member portal. Turn them off there any time.`;
  return {
    subject: `Tomorrow: ${o.title}`,
    text: `${body}${textFooter()}`,
    html: shell({
      title: `Tomorrow: ${o.title}`,
      bodyHtml: paragraphs(body).replace(
        escapeHtml(link),
        `<a href="${escapeHtml(link)}">${escapeHtml(link)}</a>`,
      ),
    }),
  };
}
