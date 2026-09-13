/**
 * Single place for site-wide constants. Everything that a real launch will
 * change lives here so nothing is buried in a component.
 */
export const SITE_NAME = 'St. Joseph the Worker Guild';
export const SITE_SHORT = 'SJWG';
export const SITE_DESCRIPTION =
  'A Catholic fraternal organization for tradesmen, based at Saint Mary of Victories in St. Louis, Missouri.';
export const PARISH_NAME = 'Saint Mary of Victories Catholic Church';
export const PARISH_CITY = 'St. Louis, Missouri';

/**
 * Donation processor is undecided. Until it is, the donate CTA points at an
 * in-page anchor. Replace with the hosted giving URL (Stripe Checkout, Zeffy,
 * Eleo page, etc.) once the board chooses. See DONOR-SYSTEM-OPTIONS.md.
 */
export const DONATE_URL = '#donate-placeholder';

/**
 * Facts that have not been supplied. Each has the real fact needed (`text`)
 * and fake stand-in copy (`sample`) so the mockup reads as finished. Rendered
 * through <Tk /> with a dotted underline and data-tk so every one is auditable.
 * All samples are fictional and listed in CONTENT-TODO.md.
 */
export const TK = {
  streetAddress: {
    text: 'street address of Saint Mary of Victories (verify)',
    sample: '744 South Third Street',
  },
  zip: { text: 'parish zip code (verify)', sample: '63102' },
  mailingAddress: {
    text: 'mailing address for the Guild',
    sample: 'P.O. Box 4200, St. Louis, MO 63102',
  },
  meetingSchedule: {
    text: 'meeting schedule (day, time, where in the church)',
    sample:
      'Tradesmen\u2019s Mass is the first Saturday of each month at 8:00 AM, with adoration and coffee after. Formation meetings are the third Thursday at 7:00 PM in the parish hall.',
  },
  taxStatus: {
    text: '501(c)(3) status line and EIN',
    sample: 'A 501(c)(3) nonprofit. EIN 00-0000000.',
  },
  phone: { text: 'Guild phone number', sample: '(314) 555-0147' },
  email: { text: 'Guild email address', sample: 'hello@sjwguild.org' },
  responseCommitment: {
    text: 'what actually happens after a request comes in, and how fast',
    sample:
      'A Guild member reads new requests every day. You will get a call within two business days. If you said no heat, no water, or not safe, someone calls the same day.',
  },
  serviceArea: {
    text: 'does the Guild have a service area boundary?',
    sample:
      'The Guild serves the St. Louis area on both sides of the river. If you are farther out, send it anyway and we will try to refer you.',
  },
  promoVideo: { text: 'promo video file and poster still', sample: 'Promo video coming soon.' },
  partnershipContact: {
    text: 'who handles partnership inquiries',
    sample: 'Partnership inquiries go to the Guild secretary, Daniel Kovach.',
  },
  legalName: { text: 'legal name for checks', sample: 'St. Joseph the Worker Guild' },
  dues: {
    text: 'dues amount and what it covers (the board has not set this figure)',
    sample: '$35 a month, or $400 a year. No man is turned away over dues.',
  },
  leadership: {
    text: 'board and officer names, and the chaplain',
    sample: 'Thomas Reilly, president. Daniel Kovach, secretary. Fr. Michael Novak, chaplain.',
  },
  whoReplies: {
    text: 'who replies to contact and membership messages, and how fast',
    sample: 'A Guild officer replies within two business days.',
  },
  volunteerRoles: {
    text: 'volunteer roles and who coordinates them',
    sample:
      'Work-day crews, procession setup, and the Christmas party kitchen. The secretary coordinates volunteers.',
  },
  fundingGoalPeriod: {
    text: 'confirm whether $60,000 is the first-year or first-six-months goal; the Case for Support and the decks differ',
    sample: 'first year',
  },
  onlineGiving: {
    text: 'donation processor and hosted giving URL; see DONOR-SYSTEM-OPTIONS.md',
    sample: 'Online giving opens soon. Until then, give by check or in person.',
  },
  parishGiving: {
    text: 'link to the parish\u2019s own giving page, or confirm it exists',
    sample: 'Give to the parish directly through the Saint Mary of Victories giving page.',
  },
  giftInPerson: {
    text: 'who to hand a gift to at a Mass or event',
    sample: 'Hand it to any Guild officer, or to the usher at a Guild Mass.',
  },
  consentCases: {
    text: 'written consent before either member case is attributed',
    sample: 'Names withheld at the members\u2019 request.',
  },
} as const;

/** Demo accounts for the faked portal. No real auth exists. */
// BACKEND: replace with a real auth provider (Netlify Identity, Clerk, Supabase Auth, etc.)
export const DEMO_ACCOUNTS = [
  { email: 'guildmember@test.com', role: 'member', name: 'Demo Guild Member', memberId: 'm-01' },
  { email: 'customer@test.com', role: 'customer', name: 'Demo Customer' },
] as const;
export const DEMO_PASSWORD = 'guild2026';
