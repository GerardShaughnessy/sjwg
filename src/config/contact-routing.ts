/**
 * Who gets each website message. Every message is also copied to the shared
 * hello@ inbox so nothing is lost when someone is away. Change an address or a
 * topic here; the contact form's dropdown is built from CONTACT_TOPICS.
 */
export const INBOX = {
  hello: 'hello@sjwg.org',
  greg: 'greg@sjwg.org',
  michael: 'michael@sjwg.org',
  secretary: 'secretary@sjwg.org',
} as const;

export const CONTACT_TOPICS = [
  { label: 'Events or the Christmas party', to: [INBOX.michael] },
  { label: 'Donations and giving', to: [INBOX.michael, INBOX.greg, INBOX.secretary] },
  { label: 'Joining, volunteering, or the directory', to: [INBOX.greg] },
  { label: 'Parishes and partnerships', to: [INBOX.greg] },
  { label: 'Guild meetings and Holy Hours', to: [INBOX.greg] },
  { label: 'Calendar, records, or a general question', to: [INBOX.secretary] },
  { label: 'Something else', to: [] },
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['label'];
export const CONTACT_TOPIC_LABELS = CONTACT_TOPICS.map((t) => t.label) as [
  ContactTopic,
  ...ContactTopic[],
];

/** Other website messages, by form kind. */
const BY_KIND: Record<string, readonly string[]> = {
  partner: [INBOX.greg],
  membership: [INBOX.greg],
  interest: [INBOX.greg],
  rsvp: [INBOX.michael],
  donation: [INBOX.michael, INBOX.greg, INBOX.secretary],
};

/** Recipients for a message: the topic's or kind's people, plus hello@, no duplicates. */
export function recipientsFor(kind: string, topic?: string): string[] {
  const people =
    kind === 'contact'
      ? (CONTACT_TOPICS.find((t) => t.label === topic)?.to ?? [])
      : (BY_KIND[kind] ?? []);
  return [...new Set<string>([...people, INBOX.hello])];
}
