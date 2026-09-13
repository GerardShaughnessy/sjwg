import type { Member } from '@/lib/types';
import { slugify } from '@/lib/trades';

const AVAILABILITY: Record<Member['availability'], { label: string; dot: string }> = {
  available: { label: 'Taking work', dot: 'bg-brass' },
  limited: { label: 'Limited availability', dot: 'bg-mortar' },
  unavailable: { label: 'Not taking work right now', dot: 'bg-charcoal/30' },
};

/**
 * One roster row. Used statically on the home page and inside the directory
 * island, so it is plain React with no Astro imports. The whole row is not a
 * link on purpose: the one link says what happens.
 */
export default function MemberCard({
  member,
  compact = false,
}: {
  member: Member;
  compact?: boolean;
}) {
  const a = AVAILABILITY[member.availability];
  const requestHref = `/request?trade=${slugify(member.trade)}`;
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
          <h3 id={`member-${member.id}-name`} className="text-h3 font-serif">
            {member.name}
          </h3>
          <p className="text-brick font-sans text-[0.95rem] font-semibold">{member.trade}</p>
        </div>
        <p className="text-ash mt-1 font-sans text-[0.95rem]">
          {member.areas.join(', ')}. {member.yearsInTrade} years in the trade.
        </p>
        {!compact && (
          <p className="mt-2 max-w-[60ch] font-serif leading-relaxed italic">“{member.bio}”</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="text-ash inline-flex items-center gap-2 font-sans text-[0.9rem]">
            <span className={`inline-block h-2.5 w-2.5 ${a.dot}`} aria-hidden="true" />
            {a.label}
          </p>
          <a
            href={requestHref}
            className="decoration-brass hover:decoration-charcoal font-sans text-[0.95rem] font-semibold underline decoration-2 underline-offset-4"
          >
            Request help with {member.trade.toLowerCase()}
          </a>
        </div>
      </div>
    </article>
  );
}
