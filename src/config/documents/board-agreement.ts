import { p, ul, type GuildDocument } from './types';

/**
 * DRAFT for attorney review. Not yet in effect. Sent to each director with
 * their name, board title, and duties merged in ({{name}}, {{title}}, {{duties}}).
 */
export const boardAgreement: GuildDocument = {
  slug: 'board-agreement',
  title: 'Board of Directors Agreement',
  version: '2026-11-24-draft',
  draft: true,
  summary:
    "What it means to serve on the Guild's board: fiduciary duties, conflicts of interest, confidentiality, and attendance.",
  signer: 'Signed by the director:',
  defaultDuties: [
    'Attend board meetings and come prepared.',
    'Review and approve the budget, the bylaws, and major decisions.',
    "Oversee the officers and the Guild's finances.",
    "Support the Guild's mission and help it find resources.",
  ],
  sections: [
    {
      blocks: [
        p(
          'This Board of Directors Agreement is between St. Joseph the Worker Guild, a Missouri nonprofit corporation (the "Guild"), and {{name}} (the "Director").',
        ),
      ],
    },
    {
      heading: '1. The position',
      blocks: [
        p('The Director serves on the Board of Directors as {{title}}.'),
        p("The Director's duties on the board are:"),
        ul('{{duties}}'),
        p(
          'This is a voluntary position. The Director is not an employee and will not be paid for serving on the board.',
        ),
      ],
    },
    {
      heading: '2. Bylaws',
      blocks: [p("The Director has read the Guild's bylaws and will follow them.")],
    },
    {
      heading: '3. Fiduciary duties',
      blocks: [
        p('The Director owes the Guild these duties:'),
        ul(
          'Care: to act in good faith, stay informed, and use the care a careful person would use in a like position.',
          "Loyalty: to put the interests of the Guild ahead of their own and anyone else's.",
          'Obedience: to keep the Guild true to its mission, its bylaws, and the law.',
        ),
      ],
    },
    {
      heading: '4. Conflicts of interest',
      blocks: [
        p(
          "The Director will follow the Guild's Conflict of Interest Policy. The Director will disclose any conflict right away and will not vote on a matter where a conflict exists.",
        ),
        p('The Director will sign a conflict of interest statement each year.'),
      ],
    },
    {
      heading: '5. Confidentiality',
      blocks: [
        p(
          'The Director will keep confidential what is said in closed sessions and any private information learned on the board, including information about donors, tradesmen, and families who ask for help. This duty continues after service ends.',
        ),
      ],
    },
    {
      heading: '6. Attendance',
      blocks: [
        p(
          'The Director will attend board meetings regularly and will tell the Chair ahead of time when they cannot attend.',
        ),
      ],
    },
    {
      heading: '7. Independent directors',
      blocks: [
        p(
          'If the Director serves as an independent director, they will stay independent. That means they will not take pay from the Guild, will not do paid business with the Guild, and will tell the Board right away if anything changes that.',
        ),
      ],
    },
    {
      heading: '8. Acknowledgment',
      blocks: [
        p(
          'I have read this Board of Directors Agreement. I understand it, and I agree to serve under it. I sign it freely.',
        ),
      ],
    },
  ],
};
