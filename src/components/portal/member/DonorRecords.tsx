import { useState } from 'react';
import { donations, type DonationView, type ManualDonation } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { GIVING_LEVELS } from '@/config/site';
import {
  btnMuted,
  btnPrimary,
  btnQuiet,
  btnSecondary,
  ErrorStrip,
  inputCls,
  Labeled,
  Loading,
  money,
  msg,
  Status,
} from '../ui';

const ACK: Record<DonationView['ackStatus'], string> = {
  not_required: '',
  pending_review: 'Receipt pending review',
  sent: 'Receipt sent',
  manual: 'Thank by hand',
};

const EMPTY: ManualDonation = {
  donorName: '',
  donorEmail: '',
  amountCents: 0,
  method: 'check',
  fund: 'general',
  tier: '',
  recurring: false,
  receivedAt: new Date().toISOString().slice(0, 10),
  note: '',
};

/**
 * Real donor records. Card gifts arrive from Stripe (checkpoint C); checks and
 * cash are entered here. CSV export is the QuickBooks path until a CRM is chosen.
 */
export default function DonorRecords() {
  const { data, loading, error } = useResource(() => donations.list(), []);
  const [form, setForm] = useState<ManualDonation>(EMPTY);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const list = data ?? [];
  const total = list.reduce((s, d) => s + d.amountCents, 0) / 100;
  const byFund = new Map<string, number>();
  const byTier = new Map<string, number>();
  for (const d of list) {
    byFund.set(d.fund, (byFund.get(d.fund) ?? 0) + d.amountCents / 100);
    if (d.tier) byTier.set(d.tier, (byTier.get(d.tier) ?? 0) + 1);
  }
  const donors = new Set(list.map((d) => d.donorEmail || d.donorName)).size;
  const recurring = list.filter((d) => d.recurring).length;
  const pendingReview = list.filter((d) => d.ackStatus === 'pending_review').length;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFields({});
    const cents = Math.round(Number(amount.replace(/[^0-9.]/g, '')) * 100);
    setPending(true);
    try {
      await donations.add({ ...form, amountCents: cents });
      setStatus(`Recorded ${money(cents / 100)} from ${form.donorName}.`);
      setForm({ ...EMPTY, receivedAt: form.receivedAt });
      setAmount('');
    } catch (err) {
      const f = (err as { fields?: Record<string, string> }).fields ?? {};
      setFields(f);
      setFormError(msg(err, 'Could not record the gift.'));
    } finally {
      setPending(false);
    }
  }

  async function mark(d: DonationView, ackStatus: DonationView['ackStatus']) {
    try {
      await donations.patch(d.id, { ackStatus });
    } catch (err) {
      setFormError(msg(err, 'Could not update that gift.'));
    }
  }

  async function remove(d: DonationView) {
    try {
      await donations.remove(d.id);
      setStatus(`Removed the ${money(d.amount)} gift from ${d.donorName}.`);
    } catch (err) {
      setFormError(msg(err, 'Could not remove that gift.'));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2">Donor records</h2>
          <p className="text-ash mt-2 max-w-[56ch] font-sans text-[0.95rem]">
            Every gift the Guild has recorded. Card gifts arrive on their own once online giving is
            on; enter checks and cash here. The CSV is what the treasurer imports into QuickBooks.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className={btnPrimary}
            aria-expanded={showForm}
          >
            {showForm ? 'Hide the form' : 'Record a gift'}
          </button>
          <a href={donations.csvUrl} className={`${btnSecondary} no-underline`} download>
            Download CSV
          </a>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={add}
          className="border-brass bg-paper mt-6 grid gap-4 border-t-4 p-6 md:grid-cols-2"
        >
          <Labeled label="Donor name" error={fields.donorName}>
            <input
              value={form.donorName}
              onChange={(e) => setForm({ ...form, donorName: e.target.value })}
              className={inputCls}
            />
          </Labeled>
          <Labeled
            label="Donor email"
            hint="Optional. Used to match repeat gifts."
            error={fields.donorEmail}
          >
            <input
              type="email"
              value={form.donorEmail}
              onChange={(e) => setForm({ ...form, donorEmail: e.target.value })}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Amount" error={fields.amountCents}>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500"
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Date received" error={fields.receivedAt}>
            <input
              type="date"
              value={form.receivedAt}
              onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="How it came">
            <select
              value={form.method}
              onChange={(e) =>
                setForm({ ...form, method: e.target.value as ManualDonation['method'] })
              }
              className={inputCls}
            >
              <option value="check">Check</option>
              <option value="cash">Cash</option>
              <option value="ach">Bank transfer</option>
              <option value="other">Other</option>
            </select>
          </Labeled>
          <Labeled label="Fund">
            <select
              value={form.fund}
              onChange={(e) => setForm({ ...form, fund: e.target.value })}
              className={inputCls}
            >
              <option value="general">General</option>
              <option value="parish-repairs">Parish repair days</option>
              <option value="medical">Medical assistance</option>
              <option value="hardship">Emergency home maintenance</option>
              <option value="education">Trades education</option>
            </select>
          </Labeled>
          <Labeled
            label="Giving level"
            hint="Optional. Levels with benefits need a receipt reviewed by the accountant."
          >
            <select
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
              className={inputCls}
            >
              <option value="">None</option>
              {GIVING_LEVELS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name} ({g.amount})
                </option>
              ))}
            </select>
          </Labeled>
          <Labeled label="Note" hint="Check number, in memory of, and so on.">
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputCls}
            />
          </Labeled>
          <label className="flex items-center gap-2 font-sans md:col-span-2">
            <input
              type="checkbox"
              className="accent-brick h-5 w-5"
              checked={form.recurring}
              onChange={(e) => setForm({ ...form, recurring: e.target.checked })}
            />
            A monthly pledge
          </label>
          {formError && (
            <div className="md:col-span-2">
              <ErrorStrip>{formError}</ErrorStrip>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? 'Saving' : 'Record the gift'}
            </button>
            <Status>{status}</Status>
          </div>
        </form>
      )}
      {!showForm && status && (
        <div className="mt-4">
          <Status>{status}</Status>
        </div>
      )}
      {!showForm && formError && (
        <div className="mt-4">
          <ErrorStrip>{formError}</ErrorStrip>
        </div>
      )}
      {error && (
        <div className="mt-6">
          <ErrorStrip>{error}</ErrorStrip>
        </div>
      )}
      {loading && !data && (
        <div className="mt-6">
          <Loading what="gifts" />
        </div>
      )}

      {data && (
        <>
          <dl className="border-mortar mt-8 grid gap-4 border-y py-5 font-sans sm:grid-cols-5">
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
              <dt className="text-ash text-[0.9rem]">Recurring</dt>
              <dd className="font-serif text-[1.6rem]">{recurring}</dd>
            </div>
            <div>
              <dt className="text-ash text-[0.9rem]">Receipts to review</dt>
              <dd className={`font-serif text-[1.6rem] ${pendingReview ? 'text-brick' : ''}`}>
                {pendingReview}
              </dd>
            </div>
          </dl>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <h3 className="text-brass font-sans text-[0.95rem] font-semibold">By fund</h3>
              <dl className="border-mortar mt-2 border-t font-sans">
                {[...byFund.entries()].map(([f, n]) => (
                  <div key={f} className="border-mortar flex justify-between border-b py-2">
                    <dt className="capitalize">{f.replace(/-/g, ' ')}</dt>
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
                    <dt className="capitalize">{t.replace(/-/g, ' ')}</dt>
                    <dd>
                      {n} {n === 1 ? 'gift' : 'gifts'}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse font-sans text-[0.95rem]">
              <caption className="sr-only">All recorded gifts</caption>
              <thead>
                <tr className="border-charcoal border-b-2 text-left">
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Donor</th>
                  <th className="py-2 pr-4 text-right font-semibold">Amount</th>
                  <th className="py-2 pr-4 font-semibold">Method</th>
                  <th className="py-2 pr-4 font-semibold">Fund</th>
                  <th className="py-2 pr-4 font-semibold">Level</th>
                  <th className="py-2 pr-4 font-semibold">Receipt</th>
                  <th className="py-2 font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id} className="border-mortar border-b align-top">
                    <td className="py-2 pr-4 whitespace-nowrap">{d.date}</td>
                    <td className="py-2 pr-4">
                      {d.donorName}
                      {d.note && <span className="text-ash block text-[0.85rem]">{d.note}</span>}
                    </td>
                    <td className="py-2 pr-4 text-right whitespace-nowrap">
                      {money(d.amount)}
                      {d.recurring ? (
                        <span className="text-ash block text-[0.8rem]">monthly</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-4 capitalize">{d.method}</td>
                    <td className="py-2 pr-4 capitalize">{d.fund.replace(/-/g, ' ')}</td>
                    <td className="py-2 pr-4 capitalize">{d.tier.replace(/-/g, ' ')}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={
                          d.ackStatus === 'pending_review' ? 'text-brick font-semibold' : 'text-ash'
                        }
                      >
                        {ACK[d.ackStatus]}
                      </span>
                      {d.ackStatus !== 'sent' && d.ackStatus !== 'not_required' && (
                        <button
                          type="button"
                          onClick={() => mark(d, 'sent')}
                          className={`${btnQuiet} block text-[0.85rem]`}
                        >
                          Mark thanked
                        </button>
                      )}
                    </td>
                    <td className="py-2">
                      {!d.stripe && (
                        <button
                          type="button"
                          onClick={() => remove(d)}
                          className={`${btnMuted} text-[0.85rem]`}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
