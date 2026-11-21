import { createHash } from 'node:crypto';

/**
 * Everything a visitor reads before the directory opens: Greg's statement, the
 * gate text, and the affirmations. Server-only (node:crypto): the page passes
 * the text to the gate island as props.
 *
 * DIRECTORY_TERMS_VERSION is a hash of the gate text and every affirmation.
 * Change a word and every visitor sees the gate again, and the affirmations
 * table records which wording each visitor agreed to.
 */

/* ------------------------------------------------------------------ intro */
export const DIRECTORY_INTRO: string[] = [
  'As Catholics, we believe that the marketplace is not separate from the moral life of society. Indeed, it is one of the surest places it is lived out every day, when men and women go to work. As Catholics, we cannot meaningfully promote a Catholic understanding of economic life while leaving Catholic consumers, families, parishes, schools, and institutions without a practical way to identify and support businesses that endeavor to conduct themselves according to Catholic principles.',
  "More specifically, we aim to strengthen the Catholic community by advancing the Church's social teaching along four principles.",
];

export const DIRECTORY_PRINCIPLES: { title: string; body: string[] }[] = [
  {
    title: 'The common good',
    body: [
      'Economic activity should contribute to the conditions in which individuals, families, and communities can morally flourish in harmony, based on a Catholic understanding.',
    ],
  },
  {
    title: 'Solidarity',
    body: [
      'We have responsibilities toward one another. We are not merely independent economic actors pursuing our own interests. Locally based Catholic businesses and clients of shared values are more likely to view their clients not as customers, but as fathers and mothers, husbands and wives, and fellow sisters and brothers in Christ. We ask Catholic tradesmen and the community alike: "Are you your brother\'s keeper?"',
    ],
  },
  {
    title: 'Subsidiarity',
    body: [
      'A well-ordered society needs businesses that may act in accordance with their state in life, respective towards their role in society. Small, family-owned, and local businesses promote the common good in their very nature. They serve as a bulwark against centralization, cartels, and monopolization by means of innovative, uncentralized competition. They make the means of production more readily available in the hands of the common man. Widespread business ownership is essential to passing skills and opportunities down to the posterity of those who own their businesses. A society without this order is what the Catholic distributist Hilaire Belloc calls a "servile state." This is a condition to be avoided at all costs.',
    ],
  },
  {
    title: 'The dignity of work',
    body: [
      'Work is not simply a means of making money. It is a human vocation through which people serve their families and society. Work was ordered towards man in the Book of Genesis as a gift that God bestowed on man, in order to participate in His creative work.',
    ],
  },
];

export const DIRECTORY_INTRO_CLOSING =
  "These principles are articulated in the Vatican's Compendium of the Social Doctrine of the Church and the Catechism, particularly paragraphs 2426–2436. The Compendium recognizes the social function of businesses and describes them as communities of persons, not merely collections of capital and commercial interests.";

export const DIRECTORY_CITATION =
  'Compendium of the Social Doctrine of the Church and the Catechism of the Catholic Church, nos. 2426–2436.';

/* ------------------------------------------------------------------- gate */
export const GATE_HEADING = 'For directory access, please read and affirm the following';

export const GATE_TEXT: string[] = [
  'As such, the Guild has done its part in promoting the common good of the Catholic community by organizing a directory of confirmed, practising Catholic tradesmen who have pledged to live out their faith in their work, their businesses, their families, and their communities. In viewing this directory, you may be participating in the fostering of our Catholic community, should you decide to commission a tradesman for services.',
  'The primary function of this directory is not to incur private benefit to any individual, business, or organization. The intent is to strengthen our Catholic community. As a potential participant in this community, please read and affirm the following below.',
];

export type Affirmation = { id: string; text: string };

/** Shown before the Catholic status question. */
export const AFFIRMATIONS_FIRST: Affirmation[] = [
  {
    id: 'readAgree',
    text: 'I have read and agree with the aforementioned content relevant to these affirmations.',
  },
];

export const CATHOLIC_STATUS = {
  catholic: 'I am a baptized, confirmed, and practising Catholic.',
  notCatholic: 'I am not a confirmed or practising Catholic.',
  alignmentPrompt:
    'Please state how you, your business, or your organization might have aligned values and why you intend to support a local Catholic community.',
} as const;

/** Shown after the Catholic status question. */
export const AFFIRMATIONS_REST: Affirmation[] = [
  {
    id: 'commonGood',
    text: 'My primary intent is not merely shopping for the best price or services, but supporting the common good by potentially commissioning a business whose values I agree with.',
  },
  {
    id: 'goodFaith',
    text: 'I intend to act in good faith, transparency, reason, and understanding, and to be a good steward over those whom I commission.',
  },
  {
    id: 'noEmployment',
    text: 'I am fully aware that the St. Joseph the Worker Guild does not employ, supervise, negotiate with, guarantee the work and quality thereof, formally endorse, or warranty any tradesman who might appear on this directory.',
  },
  {
    id: 'betweenUs',
    text: 'I am fully aware that the business practices, risks, services, and terms of agreement are solely between the tradesman and myself.',
  },
  {
    id: 'noLiability',
    text: 'I am fully aware that the St. Joseph the Worker Guild is in no way, shape, or form liable for any occurrence that might happen as a result of hiring a contractor from its directory.',
  },
  {
    id: 'pledgeNotGuarantee',
    text: 'I am fully aware that the ethical pledge does not act as a legal or implied guarantee of any particular standard, and that the pledge is merely taken in good faith.',
  },
];

export const AFFIRMATION_IDS = [...AFFIRMATIONS_FIRST, ...AFFIRMATIONS_REST].map((a) => a.id);

export const ETHICAL_PLEDGE_URL = '/documents/ethical-pledge';

/** Everything the visitor affirms, as one string. Its hash is the terms version. */
export function termsText(): string {
  return [
    GATE_HEADING,
    ...GATE_TEXT,
    ...AFFIRMATIONS_FIRST.map((a) => a.text),
    CATHOLIC_STATUS.catholic,
    CATHOLIC_STATUS.notCatholic,
    CATHOLIC_STATUS.alignmentPrompt,
    ...AFFIRMATIONS_REST.map((a) => a.text),
  ].join('\n');
}

export const DIRECTORY_TERMS_VERSION = createHash('sha256')
  .update(termsText())
  .digest('hex')
  .slice(0, 16);
