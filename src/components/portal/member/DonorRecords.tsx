import { donations } from '@/lib/store';
import { downloadCsv } from '@/lib/csv';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/**
 * Mock donor records. Shows what a custom-built donor view would look like.
 * The real source would be Stripe, a donor CRM, or both, synced to QuickBooks.
 */
export default function DonorRecords() {
  const list = donations.list();
  const total = list.reduce((s, d) => s + d.amount, 0);
  const byFund = new Map<string, number>();
  const byTier = new Map<string, number>();
  for (const d of list) {
    byFund.set(d.fund, (byFund.get(d.fund) ?? 0) + d.amount);
    if (d.tier) byTier.set(d.tier, (byTier.get(d.tier) ?? 0) + 1);
  }
  const donors = new Set(list.map((d) => d.donorName)).size;
  const recurring = list.filter((d) => d.recurring).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2">Donor records</h2>
          <p className="text-ash mt-2 max-w-[56ch] font-sans text-[0.95rem]">
            Sample data. This is what a Guild-built donor view would show. The real records would
            come from the payment processor and the donor system the board chooses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv('sjwg-donations-sample.csv', donations.toCsv())}
          className="border-charcoal hover:bg-charcoal hover:text-stone border-2 px-4 py-2.5 font-sans font-semibold"
        >
          Download CSV
        </button>
      </div>

      <dl className="border-mortar mt-8 grid gap-4 border-y py-5 font-sans sm:grid-cols-4">
        <div>
          <dt className="text-ash text-[0.9rem]">Total given</dt>
          <dd className="font-serif text-[1.6rem]">{money(total)}</dd>
        </div>
        <div>
          <dt className="text-ash text-[0.9rem]">Gifts</dt>
          <dd className="font-serif text-[1.6rem]">{list.length}</dd>
        </div>
        <div>
          <dt className="text-ash text-[0.9rem]">Donors</dt>
          <dd className="font-serif text-[1.6rem]">{donors}</dd>
        </div>
        <div>
          <dt className="text-ash text-[0.9rem]">Recurring gifts</dt>
          <dd className="font-serif text-[1.6rem]">{recurring}</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h3 className="text-brass font-sans text-[0.95rem] font-semibold">By fund</h3>
          <dl className="border-mortar mt-2 border-t font-sans">
            {[...byFund.entries()].map(([f, n]) => (
              <div key={f} className="border-mortar flex justify-between border-b py-2">
                <dt className="capitalize">{f.replace('-', ' ')}</dt>
                <dd>{money(n)}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-brass font-sans text-[0.95rem] font-semibold">By giving level</h3>
          <dl className="border-mortar mt-2 border-t font-sans">
            {[...byTier.entries()].map(([t, n]) => (
              <div key={t} className="border-mortar flex justify-between border-b py-2">
                <dt>{t}</dt>
                <dd>
                  {n} {n === 1 ? 'gift' : 'gifts'}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse font-sans text-[0.95rem]">
          <caption className="sr-only">All sample donations</caption>
          <thead>
            <tr className="border-charcoal border-b-2 text-left">
              <th className="py-2 pr-4 font-semibold">Date</th>
              <th className="py-2 pr-4 font-semibold">Donor</th>
              <th className="py-2 pr-4 text-right font-semibold">Amount</th>
              <th className="py-2 pr-4 font-semibold">Method</th>
              <th className="py-2 pr-4 font-semibold">Fund</th>
              <th className="py-2 pr-4 font-semibold">Level</th>
              <th className="py-2 font-semibold">Recurring</th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id} className="border-mortar border-b">
                <td className="py-2 pr-4 whitespace-nowrap">{d.date}</td>
                <td className="py-2 pr-4">{d.donorName}</td>
                <td className="py-2 pr-4 text-right">{money(d.amount)}</td>
                <td className="py-2 pr-4 capitalize">{d.method}</td>
                <td className="py-2 pr-4 capitalize">{d.fund.replace('-', ' ')}</td>
                <td className="py-2 pr-4">{d.tier || ''}</td>
                <td className="py-2">{d.recurring ? 'Yes' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
