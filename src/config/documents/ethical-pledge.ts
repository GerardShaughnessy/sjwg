import { ol, p, type GuildDocument } from './types';

/**
 * The pledge a tradesman takes to be listed in the Guild's directory.
 * Adopted 2026-11-24: Greg's "SJWG ETHICAL PLEDGE" (Nov 21) as the base,
 * with inclusive wording, fair and lawful wages, safety, sobriety and
 * mentoring from Milton's original, the customer-facing "not a guarantee"
 * line, and a section on what the Guild commits to in return.
 */
export const ethicalPledge: GuildDocument = {
  slug: 'ethical-pledge',
  title: 'Ethical Pledge',
  version: '2026-11-25',
  draft: false,
  summary:
    'The pledge a Catholic tradesman or tradeswoman signs to be listed in the Guild directory: faith, honest work, moral responsibility, and what the Guild commits to in return.',
  sections: [
    {
      heading: 'Purpose',
      blocks: [
        p(
          'The St. Joseph the Worker Guild seeks to cultivate a community of faithful Catholic tradesmen and tradeswomen who understand their work not merely as a living, but as a vocation through which they honor God, serve their neighbors, support their families, and contribute to the common good.',
        ),
        p(
          "Being listed in the Guild's Tradesmen Directory is a commitment to uphold the moral, spiritual, and professional standards in this pledge. Each person listed is expected to act in keeping with Catholic teaching, professional integrity, and the example of St. Joseph the Worker.",
        ),
        p('By signing this pledge, I affirm the following:'),
      ],
    },
    {
      heading: 'I. Catholic Faith and Practice',
      blocks: [
        ol(
          'I am a baptized and confirmed Catholic who professes the Catholic faith and accepts the authority and teaching of the Catholic Church.',
          'I ordinarily keep the obligations of a practicing Catholic, including attending Mass every Sunday and Holy Day of Obligation unless legitimately excused; going to confession at least once a year, and whenever needed to return to a state of grace; and keeping the precepts of the Church expected of a Catholic in good standing.',
          'I strive to live in a state of grace and to receive the sacraments regularly.',
          'I do not belong to the Freemasons, or to any religious organization or group whose beliefs and practices are incompatible with the Catholic faith, and I do not take part in occult practices such as divination or spiritism.',
          'I am registered with, or intend to register with, a Catholic parish, and I take part in its life.',
          'I take St. Joseph the Worker as the patron of my work and seek his intercession and example in my duties.',
        ),
      ],
    },
    {
      heading: 'II. Professional Integrity and Competence',
      blocks: [
        ol(
          'I keep the insurance my trade calls for, including general liability insurance when I take on work for customers.',
          'I hold, or will obtain before offering regulated work, every license, permit, and certification the law requires for the work I do, and I will show them to a customer who asks.',
          'I will represent my goods and services accurately and never knowingly misstate their quality, condition, origin, scope, or nature.',
          "I will never exploit a customer's lack of knowledge or experience for my own gain. I will charge fairly and deal honestly, especially with customers unfamiliar with the work.",
          'I will honor the contracts and agreements I make, provided the customer likewise keeps theirs.',
          'I will not abandon, neglect, or disregard an agreed project without good cause and clear communication with the customer.',
          'I will not take a deposit without a genuine intention and reasonable ability to do the work. If I cannot go forward, I will tell the customer promptly and settle any money owed honestly.',
          'I will keep all my dealings transparent and honest: estimates, invoices, contracts, change orders, warranties, schedules, and communication.',
          'I will not say or suggest that the Guild employs, endorses, certifies, guarantees, or recommends me. I may say that I am listed in the St. Joseph the Worker Guild directory.',
          'I will see my customers not merely as sources of revenue, but as brothers and sisters in Christ, owed dignity, fairness, patience, and charity.',
        ),
      ],
    },
    {
      heading: 'III. Fair Work and Safety',
      blocks: [
        ol(
          'If I employ anyone, I will pay a fair wage and follow every wage, tax, and labor law that applies. How I price my work and pay my workers is my own business, done honestly and lawfully.',
          'If I work for someone else, I will negotiate my pay in good faith and give honest work for it.',
          'I will follow the safety standards set by law and by my trade, and I will never penalize anyone who works for me for working safely.',
          'I will never work under the influence of alcohol, drugs, or any substance that impairs my work or threatens my family life.',
        ),
      ],
    },
    {
      heading: 'IV. Moral Responsibility in Business',
      blocks: [
        ol(
          'I will not knowingly use my business earnings to promote, finance, or materially support organizations whose main work directly opposes Catholic moral teaching, including abortion providers and organizations whose main purpose is promoting abortion.',
          'I will not knowingly take paid or unpaid work at abortion clinics or facilities mainly engaged in providing or promoting abortion; Masonic temples or lodges; properties mainly dedicated to occult practice; businesses built on sexual immorality; or any organization that directly contradicts the mission of the Church.',
          'I will use good judgment in my business relationships and avoid knowingly lending my labor, reputation, or money to work that directly contradicts Catholic teaching.',
        ),
      ],
    },
    {
      heading: 'V. Formation and Guild Participation',
      blocks: [
        ol(
          'I will keep growing spiritually and morally in my vocation as a Catholic tradesman or tradeswoman.',
          "I am willing to attend at least five (5) Guild meetings or Holy Hours each year, in any combination, to grow in my formation as a Catholic tradesman or tradeswoman under the patronage of St. Joseph. I understand this is voluntary, and that work, family, or emergencies excuse me from it.",
          "I will consider giving at least four (4) hours a year to the Guild's charitable work or to helping at Guild events, as my time and means allow.",
          'This time is freely given. It requires no payment from me, and it does not entitle me to pay.',
        ),
      ],
    },
    {
      heading: 'VI. Vocation and Christian Stewardship',
      blocks: [
        ol(
          'I will strive to become a holier worker, a more faithful spouse and parent where that applies, and a more responsible steward of my community.',
          "I see my trade as a share in God's creative work: a way to provide honestly for my household, serve my neighbors, and practice diligence, prudence, justice, fortitude, and charity.",
          'I will conduct myself in a way that reflects well on the Catholic faith and the Guild, knowing my work shapes how others see both.',
          'I will treat others in the trades as brothers and sisters rather than mere competitors, and encourage their professional, spiritual, and personal growth.',
          'As my time and means allow, I will help those learning the trade, and where I can, teach the next generation, including my own children.',
        ),
      ],
    },
    {
      heading: 'VII. What the Guild Commits To',
      blocks: [
        p('In return, the Guild will:'),
        ol(
          'Keep my documents and personal information private, seen only by Guild officers, and never sold.',
          'Tell me privately about any concern with my conduct and give me a fair chance to respond before any decision.',
          'Make any decision to pause or remove a listing by the Board under its written policies, and tell me the reason.',
          'List me without fees, commissions, ranking, or paid placement, in the same random order as everyone else.',
          'Support my growth in faith and trade through formation, fellowship, and prayer.',
        ),
      ],
    },
    {
      heading: 'VIII. Declaration',
      blocks: [
        ol(
          'I have read and understand this pledge, and the statements in it are true to the best of my knowledge.',
          "I take on these commitments freely, as a condition of being listed in the Guild's Tradesmen Directory.",
          'My listing is a privilege that depends on keeping this pledge. The Guild may review a concern, ask for information, and pause or remove my listing under Section VII and its policies.',
          'This pledge is not an employment agreement, partnership, or promise of referrals or business from the Guild.',
          'This pledge is made in good faith as a statement of the standards I strive to keep. It is not a legal or implied guarantee, warranty, or promise of any standard of work, conduct, or result, by me or by the Guild, to any customer or other person.',
        ),
        p('St. Joseph the Worker, pray for us.'),
      ],
    },
  ],
};
