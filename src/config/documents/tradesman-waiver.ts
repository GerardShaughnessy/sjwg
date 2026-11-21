import { ol, p, type GuildDocument } from './types';

/** DRAFT for attorney review. Not yet in effect. */
export const tradesmanWaiver: GuildDocument = {
  slug: 'tradesman-waiver',
  title: 'Tradesman Waiver and Release',
  version: '2026-11-22-draft',
  draft: true,
  summary:
    'The tradesman or tradeswoman releases the Guild from claims arising from his or her work and takes full responsibility for his or her own business.',
  sections: [
    {
      blocks: [
        p(
          'This Waiver and Release is between St. Joseph the Worker Guild, a Missouri nonprofit corporation (the "Guild"), and the tradesman who signs below ("I" or "the Tradesman"; in this document "tradesman" includes a tradeswoman). I sign it so that I may be listed in the Guild\'s directory and may take part in work arranged through the Guild\'s charity program.',
        ),
      ],
    },
    {
      heading: '1. Who is released',
      blocks: [
        p(
          'In this document, the "Released Parties" are the Guild and its officers, directors, employees, volunteers, and agents, past and present, and the parishes and other organizations that host Guild activities.',
        ),
      ],
    },
    {
      heading: '2. My work is my own',
      blocks: [
        p('I am solely responsible for:'),
        ol(
          'the quality, safety, and results of all work I do, and the work of anyone who works for me;',
          'any license, registration, or permit my work requires;',
          "my own insurance, including general liability insurance and any workers' compensation insurance the law requires;",
          'all taxes on what I earn, and all wages, taxes, and benefits owed to anyone I employ; and',
          'my own tools, materials, vehicles, and job site safety.',
        ),
      ],
    },
    {
      heading: '3. Release',
      blocks: [
        p(
          "To the fullest extent Missouri law allows, I release, waive, and discharge the Released Parties from any and all claims, demands, losses, damages, and liability of any kind, known or unknown, arising out of or related to: (a) work I do for any customer I found through the Guild's directory, (b) work I do through the Guild's charity program, and (c) my listing in the directory. This release includes claims based on the negligence of the Released Parties. It does not release claims for their gross negligence or intentional misconduct.",
        ),
      ],
    },
    {
      heading: '4. No endorsement or guarantee',
      blocks: [
        p(
          'I understand that being listed in the directory is not an endorsement, certification, recommendation, or guarantee by the Guild of me or my work. The Guild does not supervise, inspect, or guarantee any work, and does not promise me any amount of work, customers, or income.',
        ),
      ],
    },
    {
      heading: '5. Indemnification',
      blocks: [
        p(
          "I will defend, indemnify, and hold harmless the Released Parties from any claim, suit, loss, cost, or expense, including reasonable attorney fees, brought by any customer, worker, or other person and arising out of my work, my business, my employees, or my breach of this document or of the Guild's Ethical Pledge.",
        ),
      ],
    },
    {
      heading: '6. Governing law',
      blocks: [
        p(
          'This document is governed by the laws of the State of Missouri. Any lawsuit about it will be brought in the state or federal courts serving the City of St. Louis, Missouri.',
        ),
      ],
    },
    {
      heading: '7. Severability',
      blocks: [
        p(
          'If any part of this document is found unenforceable, that part will be limited to the extent needed to make it enforceable, and the rest of the document stays in full effect.',
        ),
      ],
    },
    {
      heading: '8. I have read this',
      blocks: [
        p(
          'I have read this Waiver and Release. I understand that by signing it I am giving up legal rights, including the right to sue the Released Parties for their negligence. I sign it freely and voluntarily.',
        ),
      ],
    },
  ],
};
