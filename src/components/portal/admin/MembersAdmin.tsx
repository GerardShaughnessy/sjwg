import { useState } from 'react';
import type { Member } from '@/lib/types';
import { members as api, type MemberAdmin, type MemberInput } from '@/lib/api';
import { useResource } from '@/lib/hooks';
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

const EMPTY: MemberInput = {
  name: '',
  trade: '',
  areas: [],
  yearsInTrade: 0,
  bio: '',
  availability: 'available',
  featured: false,
  public: false,
  sortOrder: 0,
  privatePhone: '',
  privateEmail: '',
};

/** Officers manage every directory entry, including the fictional seed rows. */
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

  const list = data ?? [];
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
      availability: m.availability,
      featured: m.featured,
      public: m.public,
      sortOrder: m.sortOrder,
      privatePhone: m.privatePhone,
      privateEmail: m.privateEmail,
    });
    setStatus(`Editing ${m.name}.`);
    setFormError('');
    setFields({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function reset() {
    setId(null);
    setForm(EMPTY);
    setStatus('');
    setFields({});
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFields({});
    setPending(true);
    try {
      const { member, rebuild } = id ? await api.update(id, form) : await api.create(form);
      setStatus(
        `${id ? 'Saved' : 'Added'} ${member.name}. ${member.public ? rebuildNote(rebuild) : 'Not public yet.'}`,
      );
      if (!id) reset();
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
      const { rebuild } = await api.update(m.id, {
        name: m.name,
        trade: m.trade,
        areas: m.areas,
        yearsInTrade: m.yearsInTrade,
        bio: m.bio,
        availability: m.availability,
        featured: m.featured,
        public: !m.public,
        sortOrder: m.sortOrder,
        privatePhone: m.privatePhone,
        privateEmail: m.privateEmail,
      });
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
      <form onSubmit={save} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">{id ? 'Edit member' : 'Add a member'}</h2>
        <p className="text-ash text-[0.95rem]">
          A directory entry is not the same as a login. Invite the man from the Invitations tab and
          link the invitation to his entry; then he can edit it and claim jobs himself.
        </p>
        <Labeled label="Name as listed" error={fields.name}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Labeled>
        <Labeled label="Trade" error={fields.trade}>
          <input
            value={form.trade}
            onChange={(e) => setForm({ ...form, trade: e.target.value })}
            className={inputCls}
          />
        </Labeled>
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
        <Labeled label="Availability">
          <select
            value={form.availability}
            onChange={(e) =>
              setForm({ ...form, availability: e.target.value as Member['availability'] })
            }
            className={inputCls}
          >
            <option value="available">Taking work</option>
            <option value="limited">Limited availability</option>
            <option value="unavailable">Not taking work right now</option>
          </select>
        </Labeled>
        <Labeled label="One line in his own words" error={fields.bio}>
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
            hint="Officers only. Never shown publicly."
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
            hint="Used for referrals if he has no login yet."
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
        <Labeled label="Order" hint="Lower numbers come first in the directory.">
          <input
            type="number"
            min={0}
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
            className={`${inputCls} w-28`}
          />
        </Labeled>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="accent-brick h-5 w-5"
            checked={form.featured}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          />
          Show on the home page strip
        </label>
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
              Only with his consent. Name, trade, areas, years, availability, and the line above are
              shown; the phone and email above never are.
            </span>
          </span>
        </label>
        {formError && <ErrorStrip>{formError}</ErrorStrip>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? 'Saving' : id ? 'Save changes' : 'Add member'}
          </button>
          {id && (
            <button type="button" onClick={reset} className={btnQuiet}>
              Add another instead
            </button>
          )}
          <Status>{status}</Status>
        </div>
      </form>
      <div>
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">
          All entries ({list.length})
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
                    {m.accountEmail ? `Login: ${m.accountEmail}` : 'No login yet'}
                    {m.privateEmail && !m.accountEmail ? ` · ${m.privateEmail}` : ''}
                    {m.privatePhone ? ` · ${m.privatePhone}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.95rem]">
                    <button type="button" onClick={() => edit(m)} className={btnQuiet}>
                      Edit
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
