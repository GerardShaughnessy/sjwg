import { ol, p, ul, type GuildDocument } from './types';

/**
 * The pledge a tradesman takes to be listed in the Guild's directory.
 * Adapted from the Ethical Standards and the Membership Pledge received
 * 2026-10-08 (sjwg-docs/governance). Membership, dues, meeting, recruiting,
 * and "refer Guild members first" items were removed; required charity
 * service became considering charity work.
 */
export const ethicalPledge: GuildDocument = {
  slug: 'ethical-pledge',
  title: 'Ethical Pledge',
  version: '2026-11-22',
  draft: false,
  summary:
    'The pledge a Catholic tradesman signs to be listed in the Guild directory: faith, honest work, fair dealing, and care for those in need.',
  sections: [
    {
      blocks: [
        p(
          'St. Joseph the Worker Guild keeps a directory of practicing Catholic tradesmen and tradeswomen in the St. Louis area. Everyone listed in it signs this pledge. It describes how each of us means to live the faith in our work and in our dealings with customers, workers, and the people we serve.',
        ),
        p(
          'I ask to be listed in the Guild directory. By signing below, I affirm each statement in this pledge and promise to practice these standards in my work with all clients and customers. If I work for someone else, I will keep these standards in that work and in any independent jobs or side work I take on.',
        ),
      ],
    },
    {
      heading: 'Core values',
      blocks: [
        ul(
          'Steadfast endurance. I work diligently, follow through on my commitments, and pursue excellence in everything entrusted to me.',
          'Humble service. I contribute with humility and put my talents to work for the good of others.',
          'Faithful integrity. I act honestly and openly, and keep my words, decisions, and conduct faithful to Catholic teaching.',
          'Proactive ownership. I meet obstacles with resourcefulness and personal responsibility, and keep moving forward.',
        ),
      ],
    },
    {
      heading: 'My faith and my trade',
      blocks: [
        ul(
          'I work full-time, part-time, or am retired in or from the skilled trades (including construction, mechanical, and service trades).',
          'I have received the three Sacraments of Initiation (Baptism, Confirmation, and the Eucharist), and I adhere to the Magisterium of the Catholic Church.',
          'I strive to keep the Precepts of the Church: to attend Mass on Sundays and Holy Days of Obligation and rest from work that keeps me from keeping the day holy; to confess my sins to a priest at least once a year; to receive the Eucharist at least once a year during the Easter season; to observe the days of fasting and abstinence; and to help provide for the needs of the Church, including my own parish.',
          'I believe in the mission of the Guild: to honor the dignity of work and to serve neighbors in need through the skilled trades.',
        ),
      ],
    },
    {
      heading: 'My standards of work',
      blocks: [
        ol(
          'Skill. I will do skilled work and keep improving at my trade through continued training and education.',
          'Clear dealing. I will communicate clearly with clients and customers about the work to be done, and set high but manageable expectations for it.',
          'Honesty. I will be honest and open with customers. I will not pad a bill, use pressure sales, or sell work a customer does not need.',
          'Charity. I will be charitable toward those in need, without neglecting what I owe to my own family.',
          'Fair prices for those in need. I will look for ways to reduce my prices for those in need while still giving them excellent service.',
          'A family wage. If I employ anyone, I will strive to pay a family wage, whether by the hour, by the project, or by salary. I will keep up with local costs of living and reflect on what a family wage is and what the work is worth.',
          "Good faith as an employee. If I work for someone else, I will keep in mind the limits of the project, the value of my own labor, and my employer's family needs, and I will negotiate my wage in good faith.",
          'Follow through. When I work for another tradesman or a customer, I will keep every commitment I make, take responsibility where it is mine, communicate well, be honest and open, and be a good steward of the project, the customer, and any property, materials, and tools placed in my care.',
          'Moral work. I will not take part in any project that is plainly against the moral life of the community, such as building or renovating an abortion facility, a Masonic hall, a business built on sexual immorality, or any organization that directly contradicts the mission of the Church.',
          'Sober work. I will never work under the influence of alcohol, drugs, or any substance that impairs my work or threatens my family life.',
          'Example. I will strive to be active in my community and a good example to those around me. Where I can, I will teach my children the trade so that skilled work carries on to the next generation. If the Guild raises a concern about my conduct, I will work to amend it.',
          'Mentoring. I will encourage and help those who are learning the trade, as my time and means reasonably allow.',
          'Charity among tradesmen. I will support other Catholic tradesmen and deal with them in a spirit of charity.',
          'Speaking up. I will speak up about usurious, extortionate, or bad-faith practices I meet in the trades, so that others are not harmed by them.',
          'Safety. I will follow the safety standards set by law and by the trade, and I will never penalize anyone who works for me for working safely.',
          'Licenses and insurance. I will keep any license and insurance my trade requires current, and show them to a customer who asks.',
          'Truth about the Guild. I will not say or suggest that the Guild employs, endorses, certifies, guarantees, or recommends me. I may say that I am listed in the St. Joseph the Worker Guild directory.',
          'Charity work. I will consider taking part in the charitable work of the Guild, such as repairs for neighbors in need, as my time and means allow.',
        ),
      ],
    },
    {
      heading: 'My affirmation',
      blocks: [
        p(
          'I make this pledge sincerely. I understand that my directory listing depends on keeping it, and that the Guild may pause or remove my listing if I do not.',
        ),
        p(
          'This pledge is taken in good faith as a statement of the standards I strive to keep. It is not a legal or implied guarantee, warranty, or promise of any standard of workmanship, conduct, or result, by me or by the Guild, to any customer or other person.',
        ),
      ],
    },
  ],
};
