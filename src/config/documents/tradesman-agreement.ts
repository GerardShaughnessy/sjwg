import { ol, p, type GuildDocument } from './types';

/**
 * DRAFT for attorney review. Not yet in effect.
 * Adapted from "04 Directory listing agreement" (Nov 3, 2026 draft) to the
 * current model: no service commitment, opt-in contact info, and charity
 * program work paid as an independent vendor.
 */
export const tradesmanAgreement: GuildDocument = {
  slug: 'tradesman-agreement',
  title: 'Tradesman Listing Agreement',
  version: '2026-11-22-draft',
  draft: true,
  summary:
    'The independent contractor agreement for a directory listing, including how the charity program pays tradesmen as vendors.',
  sections: [
    {
      blocks: [
        p(
          'This Listing Agreement is between St. Joseph the Worker Guild, a Missouri nonprofit corporation (the "Guild"), and the tradesman who signs below ("I" or "the Tradesman"; in this document "tradesman" includes a tradeswoman). It sets the terms on which the Guild lists me in its directory of Catholic tradesmen and on which I may do work paid for by the Guild\'s charity program.',
        ),
      ],
    },
    {
      heading: '1. I am independent',
      blocks: [
        p(
          'I run my own business. I am not an employee, agent, partner, or joint venturer of the Guild, and nothing in this agreement or my listing makes me one. I have no authority to sign anything or make any promise for the Guild, and I will not say or suggest that I do.',
        ),
      ],
    },
    {
      heading: '2. What the Guild does not do',
      blocks: [
        p(
          'The Guild does not supervise, direct, schedule, inspect, negotiate, guarantee, or warrant any work I do. It does not set my prices, hours, or methods, and does not settle disputes between me and a customer.',
        ),
      ],
    },
    {
      heading: '3. My customers are my business',
      blocks: [
        p(
          'Everything between me and a customer, including the price, the terms, the work, payment, warranties, and any dispute, is our own business and my own liability. I am responsible for my own work, licenses, permits, insurance, taxes, tools, materials, and employees.',
        ),
      ],
    },
    {
      heading: '4. No fees or commissions',
      blocks: [
        p(
          'Listing is free. No listing fee, referral fee, commission, or share of any job is charged to me or paid to me by the Guild for a listing or a referral, and I will not pay or accept a kickback for a referral connected with the directory. A gift I choose to make to the Guild has no effect on my listing.',
        ),
      ],
    },
    {
      heading: '5. What listing requires',
      blocks: [
        p('To be listed, and to stay listed, I must provide and keep current:'),
        ol(
          "the Guild's Ethical Pledge, signed by me;",
          'proof of my Baptism and Confirmation;',
          'any license or registration my trade requires where I work; and',
          'any insurance my trade requires, and general liability insurance if the Guild asks for it.',
        ),
        p(
          'The Guild may verify these documents, including by checking a public license lookup, contacting my insurer, or contacting my parish. I will tell the Guild within 14 days if a required license or insurance policy lapses or is cancelled. The Guild may pause my listing until a current document is on file.',
        ),
      ],
    },
    {
      heading: '6. My contact information',
      blocks: [
        p(
          'My phone number and email address are shown in the directory only if I opt in to showing them, and I may opt out at any time. The documents I give the Guild are kept private and are seen only by Guild officers.',
        ),
      ],
    },
    {
      heading: '7. Charity program work',
      blocks: [
        p(
          "From time to time the Guild's charity program may pay me on behalf of someone in need, for materials, for my time, or both, at a free, discounted, or agreed price. When it does:",
        ),
        ol(
          'I am paid as an independent vendor, not as an employee, and I will give the Guild an invoice for the agreed amount;',
          'I am responsible for my own taxes on what I am paid. I will give the Guild a completed IRS Form W-9, and I understand the Guild will issue a Form 1099 where the law requires;',
          'the price and scope will be agreed in writing before the work starts, and the Guild owes nothing beyond what it agreed to pay; and',
          'before I accept the work, I will tell the Guild if I have any family or business relationship with a Guild officer or director, so the Guild can handle it under its conflict of interest policy. A related officer or director will take no part in the decision.',
        ),
      ],
    },
    {
      heading: '8. Ending the listing',
      blocks: [
        p(
          'Either the Guild or I may end my listing at any time, for any reason, by telling the other in writing or by email. The Guild will take my listing down within 7 days of my request. Sections 1, 2, 3, 7, and 9 continue after my listing ends.',
        ),
      ],
    },
    {
      heading: '9. Governing law and other terms',
      blocks: [
        p(
          'This agreement is governed by the laws of the State of Missouri. If any part of it is found unenforceable, the rest stays in effect. This agreement, the Ethical Pledge, and the Tradesman Waiver and Release are the whole agreement between the Guild and me about my listing.',
        ),
      ],
    },
  ],
};
