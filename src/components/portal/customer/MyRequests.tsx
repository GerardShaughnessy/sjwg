import { requests } from '@/lib/store';
import { useStoreVersion } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import type { RequestStatus } from '@/lib/types';

const STATUS: Record<RequestStatus, string> = {
  open: 'Received. Not yet claimed by a member.',
  claimed: 'A Guild member has taken it and will call.',
  referred: 'Referred to a member who does this work.',
  closed: 'Closed.',
};

/** What the customer sees: requests sent from this browser. */
export default function MyRequests() {
  useStoreVersion();
  const mine = requests.mine();
  return (
    <div>
      <h2 className="text-h2">Your requests</h2>
      <p className="text-ash mt-2 max-w-[56ch] font-sans text-[0.95rem]">
        Requests sent from this browser. In the real system, these would follow your email or phone
        number.
      </p>
      {mine.length === 0 ? (
        <div className="border-brass bg-paper mt-8 border-t-4 p-6">
          <p>No requests yet.</p>
          <a
            href="/request"
            className="bg-brick text-paper hover:bg-kiln mt-4 inline-flex px-5 py-3 font-sans font-semibold no-underline"
          >
            Request help from the Guild
          </a>
        </div>
      ) : (
        <>
          <ul className="border-mortar mt-6 border-t">
            {mine.map((r) => (
              <li key={r.id} className="border-mortar border-b py-5">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h3 className="text-h3">{r.trade}</h3>
                  <span className="text-ash font-sans text-[0.9rem]">
                    Ref {r.ref}. Sent {formatShortDate(r.createdAt)}.
                  </span>
                </div>
                <p className="mt-2 max-w-[64ch] leading-relaxed">{r.description}</p>
                <p className="mt-2 font-sans font-semibold">{STATUS[r.status]}</p>
              </li>
            ))}
          </ul>
          <a
            href="/request"
            className="border-charcoal hover:bg-charcoal hover:text-stone mt-8 inline-flex border-2 px-5 py-3 font-sans font-semibold no-underline"
          >
            Send another request
          </a>
        </>
      )}
    </div>
  );
}
