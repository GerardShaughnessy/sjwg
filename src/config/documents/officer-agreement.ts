import { p, ul, type GuildDocument } from './types';

/**
 * DRAFT for attorney review. Not yet in effect. Sent to each officer with
 * their name, title, and duties merged in ({{name}}, {{title}}, {{duties}}).
 */
export const officerAgreement: GuildDocument = {
  slug: 'officer-agreement',
  title: 'Officer Agreement',
  version: '2026-11-24-draft',
  draft: true,
  summary:
    "What it means to serve as a Guild officer: the role and its duties, conduct, confidentiality, and the limits of an officer's authority.",
  signer: 'Signed by the officer:',
  defaultDuties: [
    'Carry out the work of the office as the bylaws and the Board describe it.',
    'Attend officer meetings and report on the work of the office.',
    'Keep accurate records for the office and share them with the Board on request.',
    'Work with the other officers and the Board for the good of the Guild.',
  ],
  sections: [
    {
      blocks: [
        p(
          'This Officer Agreement is between St. Joseph the Worker Guild, a Missouri nonprofit corporation (the "Guild"), and {{name}} (the "Officer").',
        ),
      ],
    },
    {
      heading: '1. The role',
      blocks: [
        p('The Officer will serve as {{title}} of the Guild.'),
        p("The Officer's primary duties are:"),
        ul('{{duties}}'),
        p(
          'The Board may change these duties at any time. When acting in this role, the Officer represents the Guild.',
        ),
      ],
    },
    {
      heading: '2. Volunteer and unpaid',
      blocks: [
        p(
          'This is a volunteer position. The Officer is not an employee and will not be paid. The only exception is compensation the Board approves in writing. Any approved compensation must also have the paperwork the law requires, such as a W-9 or other tax forms.',
        ),
        p(
          "The Guild may repay reasonable expenses the Officer has approved in advance, following the Guild's expense rules.",
        ),
      ],
    },
    {
      heading: '3. Appointment and removal',
      blocks: [
        p(
          'The Board has sole control over appointing and removing officers. The Officer serves at the pleasure of the Board.',
        ),
        p(
          'The Board may end this appointment at any time, with or without cause, as the bylaws and Missouri law allow. The Officer may resign at any time by writing to the Board.',
        ),
      ],
    },
    {
      heading: '4. Conduct',
      blocks: [
        p('While serving, the Officer will:'),
        ul(
          'act in a way that is consistent with the teaching of the Catholic Church;',
          'be honest in all dealings for and with the Guild;',
          'keep confidential any private information learned in the role, including information about donors, tradesmen, families who ask for help, and Guild business, both during and after service;',
          "disclose any conflict of interest right away, as the Guild's Conflict of Interest Policy requires, and step back from any decision where a conflict exists; and",
          "follow the Guild's bylaws and policies.",
        ),
      ],
    },
    {
      heading: '5. Limits on authority',
      blocks: [
        p(
          'The Officer may not sign contracts, spend Guild money, take on debt, or otherwise bind the Guild unless the Board has authorized it. The Board may give that authority in a resolution or a written policy.',
        ),
      ],
    },
    {
      heading: '6. Guild property and records',
      blocks: [
        p(
          'Guild property and records belong to the Guild. This includes documents, files, email accounts, passwords, keys, money, and equipment. When service ends, for any reason, the Officer will return all of them promptly and keep no copies.',
        ),
      ],
    },
    {
      heading: '7. Indemnity',
      blocks: [
        p(
          'The Guild will indemnify the Officer only as its bylaws and Missouri law allow. The Guild will not indemnify the Officer for gross negligence, willful misconduct, acts outside the role, or acts the Board did not authorize.',
        ),
      ],
    },
    {
      heading: '8. Governing law',
      blocks: [p('This agreement is governed by the laws of the State of Missouri.')],
    },
    {
      heading: '9. Acknowledgment',
      blocks: [
        p(
          'I have read this Officer Agreement. I understand it, and I agree to serve under it. I sign it freely.',
        ),
      ],
    },
  ],
};
