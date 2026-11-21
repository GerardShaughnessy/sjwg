import type { Member } from '@/lib/types';

/** Phone and email a tradesman chose to show to visitors who affirmed the directory terms. */
export type MemberContact = { phone: string; email: string };

/** tel: href from a phone typed any which way. US numbers get +1. */
export function telHref(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `tel:+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `tel:+${d}`;
  return `tel:${d}`;
}

/**
 * One roster row. Used statically on the home page and inside the directory
 * island, so it is plain React with no Astro imports. The whole row is not a
 * link on purpose: the one link says what happens.
 */
export default function MemberCard({
  member,
  compact = false,
  headingLevel = 3,
  contact = null,
}: {
  member: Member;
  compact?: boolean;
  headingLevel?: 2 | 3;
  /** Only passed in the gated directory, and only for tradesmen who opted in. */
  contact?: MemberContact | null;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const linkCls =
    'decoration-brass hover:decoration-charcoal font-sans text-[0.95rem] font-semibold underline decoration-2 underline-offset-4';
  return (
    <article
      className="border-mortar grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-2 border-t py-5 sm:grid-cols-[6rem_1fr] sm:gap-x-6"
      aria-labelledby={`member-${member.id}-name`}
    >
      {member.photo ? (
        <img
          src={member.photo}
          alt={`Portrait of ${member.name}`}
          width={96}
          height={96}
          loading="lazy"
          className="stock aspect-square w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={`Portrait of ${member.name}, photo pending`}
          className="placeholder-region aspect-square w-full"
        >
          <span aria-hidden="true" className="text-charcoal/70 font-serif text-[1.4rem]">
            {member.name
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </span>
        </div>
      )}

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Heading id={`member-${member.id}-name`} className="text-h3 font-serif">
            {member.name}
          </Heading>
          <p className="text-brick font-sans text-[0.95rem] font-semibold">{member.trade}</p>
        </div>
        {(member.areas.length > 0 || member.yearsInTrade > 0) && (
          <p className="text-ash mt-1 font-sans text-[0.95rem]">
            {[
              member.areas.join(', '),
              member.yearsInTrade > 0 && `${member.yearsInTrade} years in the trade`,
            ]
              .filter(Boolean)
              .join('. ')}
            .
          </p>
        )}
        {!compact && member.bio && (
          <p className="mt-2 max-w-[60ch] font-serif leading-relaxed italic">“{member.bio}”</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {contact && (contact.phone || contact.email) ? (
            <>
              {contact.phone && (
                <a
                  href={telHref(contact.phone)}
                  className={linkCls}
                  aria-label={`Call ${member.name} at ${contact.phone}`}
                >
                  {contact.phone}
                </a>
              )}
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  className={`${linkCls} break-all`}
                  aria-label={`Email ${member.name} at ${contact.email}`}
                >
                  {contact.email}
                </a>
              )}
            </>
          ) : (
            <a href="/contact" className={linkCls}>
              Contact through the Guild
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
