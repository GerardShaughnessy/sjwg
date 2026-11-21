import { useState } from 'react';
import {
  members as api,
  hours as hoursApi,
  type MemberAdmin as MemberAdminBase,
  type MemberInput as MemberInputBase,
} from '@/lib/api';
import ServiceHours from '../member/ServiceHours';
import InvitationsPanel, { type InvitePrefill } from './InvitationsPanel';
import { useResource } from '@/lib/hooks';
import { byTradeThenName, COMMON_TRADES, OTHER_TRADE } from '@/lib/trades';
import {
  btnMuted,
  btnPrimary,
  btnQuiet,
  btnSecondary,
  ErrorStrip,
  inputCls,
  Labeled,
  Loading,
  msg,
  rebuildNote,
  Status,
} from '../ui';

/** The API also returns and accepts the contact opt-in. */
type MemberAdmin = MemberAdminBase & { showContact?: boolean };
type MemberInput = MemberInputBase & { showContact: boolean };

const EMPTY: MemberInput = {
  name: '',
  trade: '',
  areas: [],
  yearsInTrade: 0,
  bio: '',
  featured: false,
  public: false,
  sortOrder: 0,
  privatePhone: '',
  privateEmail: '',
  showContact: false,
};

/**
 * Officers invite men and manage every directory entry. Inviting is the way in:
 * the man sets up his own entry from the link, then it shows in the list here.
 */
export default function MembersAdmin({ areas }: { areas: string[] }) {
  const { data, loading, error } = useResource(() => api.list() as Promise<MemberAdmin[]>, []);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<MemberInput>(EMPTY);
  const [newArea, setNewArea] = useState('');
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const year = new Date().getFullYear();
  const totalsRes = useResource(() => hoursApi.totals(year), []);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const hoursFor = (m: MemberAdmin) => totals[m.id] ?? totalsRes.data?.[m.id] ?? 0;
  const [hoursOpen, setHoursOpen] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<InvitePrefill | null>(null);
  function invite(m: MemberAdmin) {
    reset();
    setPrefill({ email: m.privateEmail, name: m.name, phone: m.privatePhone, memberId: m.id });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const [sortBy, setSortBy] = useState<'trade' | 'name'>('trade');
  const list = (data ?? [])
    .slice()
    .sort(sortBy === 'trade' ? byTradeThenName : (a, b) => a.name.localeCompare(b.name));
  const isCommon = (COMMON_TRADES as readonly string[]).includes(form.trade);
  const [otherTrade, setOtherTrade] = useState(false);
  const tradeChoice = isCommon ? form.trade : form.trade || otherTrade ? OTHER_TRADE : '';
  const allAreas = [...new Set([...areas, ...list.flatMap((m) => m.areas), ...form.areas])].sort(
    (a, b) => a.localeCompare(b),
  );

  function edit(m: MemberAdmin) {
    setId(m.id);
    setForm({
      name: m.name,
      trade: m.trade,
      areas: m.areas,
      yearsInTrade: m.yearsInTrade,
      bio: m.bio,
      featured: m.featured,
      public: m.public,
      sortOrder: m.sortOrder,
      privatePhone: m.privatePhone,
      privateEmail: m.privateEmail,
      showContact: Boolean(m.showContact),
    });
    setPrefill(null);
    setStatus(`Editing ${m.name}.`);
    setFormError('');
    setFields({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function reset() {
    setOtherTrade(false);
    setId(null);
    setForm(EMPTY);
    setStatus('');
    setFields({});
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setFormError('');
    setFields({});
    setPending(true);
    try {
      const { member, rebuild } = await api.update(id, form);
      setStatus(
        `Saved ${member.name}. ${member.public ? rebuildNote(rebuild) : 'Not public yet.'}`,
      );
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setFormError(msg(err, 'Could not save.'));
    } finally {
      setPending(false);
    }
  }
  async function remove(m: MemberAdmin) {
    setBusy(m.id);
    try {
      const { rebuild } = await api.remove(m.id);
      if (id === m.id) reset();
      setStatus(`Removed ${m.name}. ${rebuildNote(rebuild)}`);
    } catch (err) {
      setFormError(msg(err, 'Could not remove that entry.'));
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  }
  async function photo(m: MemberAdmin, file: File | null) {
    if (!file) return;
    setBusy(m.id);
    try {
      const { rebuild } = await api.uploadPhoto(m.id, file);
      setStatus(`Photo saved for ${m.name}. ${m.public ? rebuildNote(rebuild) : ''}`);
    } catch (err) {
      setFormError(msg(err, 'Could not upload the photo.'));
    } finally {
      setBusy(null);
    }
  }
  async function togglePublic(m: MemberAdmin) {
    setBusy(m.id);
    try {
      const input: MemberInput = {
        name: m.name,
        trade: m.trade,
        areas: m.areas,
        yearsInTrade: m.yearsInTrade,
        bio: m.bio,
        featured: m.featured,
        public: !m.public,
        sortOrder: m.sortOrder,
        privatePhone: m.privatePhone,
        privateEmail: m.privateEmail,
        showContact: Boolean(m.showContact),
      };
      const { rebuild } = await api.update(m.id, input);
      setStatus(`${m.name} is now ${m.public ? 'private' : 'public'}. ${rebuildNote(rebuild)}`);
    } catch (err) {
      setFormError(msg(err, 'Could not change that.'));
    } finally {
      setBusy(null);
    }
  }
  const toggleArea = (a: string) =>
    setForm((f) => ({
      ...f,
      areas: f.areas.includes(a) ? f.areas.filter((x) => x !== a) : [...f.areas, a],
    }));

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      {!id ? (
        <InvitationsPanel
          key={prefill?.memberId ?? 'new'}
          prefill={prefill}
          onClearPrefill={() => setPrefill(null)}
        />
      ) : (
        <form onSubmit={save} className="flex flex-col gap-5 font-sans">
          <h2 className="text-h2 font-serif">Edit {form.name || 'member'}</h2>
          <p className="text-ash text-[0.95rem]">
            They can edit most of this themselves in My entry once they have a login.
          </p>
          <Labeled label="Name as listed" error={fields.name}>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Trade" error={fields.trade}>
            <select
              value={tradeChoice}
              onChange={(e) => {
                const v = e.target.value;
                setOtherTrade(v === OTHER_TRADE);
                setForm({ ...form, trade: v === OTHER_TRADE ? '' : v });
              }}
              className={inputCls}
            >
              <option value="">Pick a trade</option>
              {COMMON_TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={OTHER_TRADE}>Other (type it in)</option>
            </select>
          </Labeled>
          {tradeChoice === OTHER_TRADE && (
            <Labeled label="His trade" error={fields.trade}>
              <input
                value={form.trade}
                onChange={(e) => setForm({ ...form, trade: e.target.value })}
                placeholder="For example, Stained Glass"
                className={inputCls}
                autoFocus
              />
            </Labeled>
          )}
          <Labeled label="Years in the trade" error={fields.yearsInTrade}>
            <input
              type="number"
              min={0}
              value={form.yearsInTrade}
              onChange={(e) => setForm({ ...form, yearsInTrade: Number(e.target.value) || 0 })}
              className={`${inputCls} w-28`}
            />
          </Labeled>
          <fieldset>
            <legend className="font-semibold">Areas served</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {allAreas.map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-brick h-5 w-5"
                    checked={form.areas.includes(a)}
                    onChange={() => toggleArea(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={newArea}
                onChange={(e) => setNewArea(e.target.value)}
                placeholder="Another area"
                className={`${inputCls} w-48`}
                aria-label="Another area"
              />
              <button
                type="button"
                onClick={() => {
                  if (newArea.trim()) setForm({ ...form, areas: [...form.areas, newArea.trim()] });
                  setNewArea('');
                }}
                className={btnSecondary}
              >
                Add
              </button>
            </div>
            {fields.areas && (
              <p className="text-brick mt-1 text-[0.95rem] font-semibold">{fields.areas}</p>
            )}
          </fieldset>
          <Labeled label="One line in their own words" error={fields.bio}>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={3}
              maxLength={280}
              className={inputCls}
            />
          </Labeled>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled
              label="Phone (private)"
              hint="Officers only. Shown in the directory only if the tradesman turns on that setting."
              error={fields.privatePhone}
            >
              <input
                type="tel"
                value={form.privatePhone}
                onChange={(e) => setForm({ ...form, privatePhone: e.target.value })}
                className={inputCls}
              />
            </Labeled>
            <Labeled
              label="Email (private)"
              hint="Used for paperwork and contact if they have no login yet."
              error={fields.privateEmail}
            >
              <input
                type="email"
                value={form.privateEmail}
                onChange={(e) => setForm({ ...form, privateEmail: e.target.value })}
                className={inputCls}
              />
            </Labeled>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brick h-5 w-5"
              checked={form.featured}
              onChange={(e) => setForm({ ...form, featured: e.target.checked })}
            />
            Show on the home page strip
          </label>
          <p className="text-[0.95rem]">
            <span className="font-semibold">Phone and email in the directory: </span>
            {form.showContact ? 'Shown' : 'Not shown'}
            <span className="text-ash block text-[0.9rem]">
              Only the tradesman can change this, from My entry in their portal, because it needs
              their consent.
            </span>
          </p>
          <label className="border-brass bg-paper flex items-start gap-3 border-l-4 px-4 py-3">
            <input
              type="checkbox"
              className="accent-brick mt-1 h-5 w-5"
              checked={form.public}
              onChange={(e) => setForm({ ...form, public: e.target.checked })}
            />
            <span>
              <span className="font-semibold">Listed in the public directory.</span>
              <span className="text-ash block text-[0.9rem]">
                Only with their consent. Name, trade, areas, years, and the line above are shown.
                The phone and email are shown only if they turn on that setting.
              </span>
            </span>
          </label>
          {formError && <ErrorStrip>{formError}</ErrorStrip>}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending} className={btnPrimary}>
              {pending ? 'Saving' : 'Save changes'}
            </button>
            <button type="button" onClick={reset} className={btnQuiet}>
              Done, back to inviting
            </button>
            <Status>{status}</Status>
          </div>
        </form>
      )}
      <div>
        <h3 className="text-brass-ink font-sans text-[0.95rem] font-semibold">
          Members ({list.length})
        </h3>
        {error && (
          <div className="mt-2">
            <ErrorStrip>{error}</ErrorStrip>
          </div>
        )}
        {loading && !data && (
          <div className="mt-2">
            <Loading what="members" />
          </div>
        )}
        {list.length > 1 && (
          <div className="mt-2 flex items-center gap-3 text-[0.9rem]">
            <span className="text-ash">Sort by</span>
            {(['trade', 'name'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSortBy(k)}
                aria-pressed={sortBy === k}
                className={
                  sortBy === k
                    ? 'decoration-brass font-semibold underline decoration-2 underline-offset-4'
                    : 'text-ash hover:text-charcoal'
                }
              >
                {k === 'trade' ? 'Trade' : 'Name'}
              </button>
            ))}
          </div>
        )}
        {list.length > 0 && (
          <ul className="border-mortar mt-2 border-t font-sans">
            {list.map((m) => (
              <li
                key={m.id}
                className="border-mortar grid grid-cols-[4rem_1fr] gap-4 border-b py-4"
              >
                <div className="bg-paper border-mortar flex aspect-square w-16 items-center justify-center overflow-hidden border">
                  {m.photo ? (
                    <img
                      src={m.photo}
                      alt={`Portrait of ${m.name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-ash text-[0.75rem]">No photo</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-[1.15rem]">
                    {m.name}
                    <span className="text-brick ml-2 font-sans text-[0.85rem] font-semibold">
                      {m.trade}
                    </span>
                    {m.sample && (
                      <span className="bg-mortar/50 ml-2 px-1.5 py-0.5 font-sans text-[0.8rem]">
                        sample
                      </span>
                    )}
                    {!m.public && (
                      <span className="bg-mortar/50 ml-2 px-1.5 py-0.5 font-sans text-[0.8rem]">
                        private
                      </span>
                    )}
                  </p>
                  <p className="text-ash text-[0.85rem]">
                    {year} service hours: {Math.round(hoursFor(m) * 100) / 100} of 16 ·{' '}
                    {m.accountEmail ? `Login: ${m.accountEmail}` : 'No login yet'}
                    {m.privateEmail && !m.accountEmail ? ` · ${m.privateEmail}` : ''}
                    {m.privatePhone ? ` · ${m.privatePhone}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.95rem]">
                    <button type="button" onClick={() => edit(m)} className={btnQuiet}>
                      Edit
                    </button>
                    {!m.accountEmail && !m.sample && (
                      <button type="button" onClick={() => invite(m)} className={btnQuiet}>
                        Invite
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setHoursOpen(hoursOpen === m.id ? null : m.id)}
                      aria-expanded={hoursOpen === m.id}
                      className={btnQuiet}
                    >
                      {hoursOpen === m.id ? 'Close hours' : 'Hours'}
                    </button>
                    <button
                      type="button"
                      onClick={() => togglePublic(m)}
                      disabled={busy === m.id}
                      className={btnQuiet}
                    >
                      {m.public ? 'Make private' : 'Make public'}
                    </button>
                    <label className={`${btnSecondary} cursor-pointer px-3 py-1.5 text-[0.9rem]`}>
                      {busy === m.id ? 'Working' : m.photo ? 'Replace photo' : 'Add photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => photo(m, e.target.files?.[0] ?? null)}
                        disabled={busy === m.id}
                      />
                    </label>
                    {confirmDelete === m.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-brick font-semibold">Remove {m.name}?</span>
                        <button
                          type="button"
                          onClick={() => remove(m)}
                          disabled={busy === m.id}
                          className={btnMuted}
                        >
                          Yes, remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(null)}
                          className={btnQuiet}
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(m.id)}
                        className={btnMuted}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {hoursOpen === m.id && (
                  <div className="bg-paper border-mortar col-span-2 border p-4">
                    <ServiceHours
                      memberId={m.id}
                      name={m.name}
                      onTotal={(h) => setTotals((t) => ({ ...t, [m.id]: h }))}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
