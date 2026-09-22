import { useState } from 'react';
import { sponsors as api, type Sponsor, type SponsorInput } from '@/lib/api';
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

const TIERS: { value: Sponsor['tier']; label: string }[] = [
  { value: 'partner', label: 'Partner' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'supporter', label: 'Supporter' },
  { value: 'in-kind', label: 'In-kind' },
];

const EMPTY: SponsorInput = {
  name: '',
  url: '',
  tier: 'sponsor',
  logoAlt: '',
  active: true,
  sortOrder: 0,
};

/** Sponsors and partners shown on the home page and the donate page. */
export default function SponsorsEditor() {
  const { data, loading, error } = useResource(() => api.list(), []);
  const [id, setId] = useState<string | null>(null);
  const [form, setForm] = useState<SponsorInput>(EMPTY);
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [logoBusy, setLogoBusy] = useState<string | null>(null);

  function edit(s: Sponsor) {
    setId(s.id);
    setForm({
      name: s.name,
      url: s.url,
      tier: s.tier,
      logoAlt: s.logoAlt === s.name ? '' : s.logoAlt,
      active: s.active,
      sortOrder: s.sortOrder,
    });
    setStatus(`Editing ${s.name}.`);
    setFormError('');
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
      const { sponsor, rebuild } = id ? await api.update(id, form) : await api.create(form);
      setStatus(
        `${id ? 'Saved' : 'Added'} ${sponsor.name}. ${sponsor.logo ? '' : 'Upload a logo from the list on the right. '}${rebuildNote(rebuild)}`,
      );
      if (!id) reset();
    } catch (err) {
      setFields((err as { fields?: Record<string, string> }).fields ?? {});
      setFormError(msg(err, 'Could not save.'));
    } finally {
      setPending(false);
    }
  }
  async function upload(s: Sponsor, file: File | null) {
    if (!file) return;
    setLogoBusy(s.id);
    setFormError('');
    try {
      const { rebuild } = await api.uploadLogo(s.id, file);
      setStatus(`Logo saved for ${s.name}. ${rebuildNote(rebuild)}`);
    } catch (err) {
      setFormError(msg(err, 'Could not upload the logo.'));
    } finally {
      setLogoBusy(null);
    }
  }
  async function remove(s: Sponsor) {
    try {
      const { rebuild } = await api.remove(s.id);
      if (id === s.id) reset();
      setStatus(`Removed ${s.name}. ${rebuildNote(rebuild)}`);
    } catch (err) {
      setFormError(msg(err, 'Could not remove that.'));
    }
  }

  const list = data ?? [];

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <form onSubmit={save} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">{id ? 'Edit sponsor' : 'Add a sponsor or partner'}</h2>
        <p className="text-ash text-[0.95rem]">
          Active sponsors appear in a logo strip on the home page and the donate page, grouped by
          tier. Save first, then upload the logo.
        </p>
        <Labeled label="Name" error={fields.name}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputCls}
          />
        </Labeled>
        <Labeled label="Website" hint="Optional. The logo links here." error={fields.url}>
          <input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className={inputCls}
          />
        </Labeled>
        <Labeled label="Tier">
          <select
            value={form.tier}
            onChange={(e) => setForm({ ...form, tier: e.target.value as Sponsor['tier'] })}
            className={inputCls}
          >
            {TIERS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Labeled>
        <Labeled
          label="Logo description"
          hint="What a screen reader says. Defaults to the name."
          error={fields.logoAlt}
        >
          <input
            value={form.logoAlt}
            onChange={(e) => setForm({ ...form, logoAlt: e.target.value })}
            className={inputCls}
          />
        </Labeled>
        <Labeled label="Order" hint="Lower numbers come first within a tier.">
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
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          Show on the site
        </label>
        {formError && <ErrorStrip>{formError}</ErrorStrip>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? 'Saving' : id ? 'Save changes' : 'Add sponsor'}
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
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">Sponsors and partners</h3>
        {error && (
          <div className="mt-2">
            <ErrorStrip>{error}</ErrorStrip>
          </div>
        )}
        {loading && !data && (
          <div className="mt-2">
            <Loading what="sponsors" />
          </div>
        )}
        {data && list.length === 0 && (
          <p className="text-ash mt-2 font-sans">
            None yet. The strip on the site stays hidden until the first one is added.
          </p>
        )}
        {list.length > 0 && (
          <ul className="border-mortar mt-2 border-t font-sans">
            {list.map((s) => (
              <li
                key={s.id}
                className="border-mortar grid grid-cols-[6rem_1fr] gap-4 border-b py-4"
              >
                <div className="bg-paper border-mortar flex h-16 w-24 items-center justify-center border">
                  {s.logo ? (
                    <img
                      src={s.logo}
                      alt={s.logoAlt}
                      className="max-h-14 max-w-[5.5rem] object-contain"
                    />
                  ) : (
                    <span className="text-ash text-[0.8rem]">No logo</span>
                  )}
                </div>
                <div>
                  <p className="font-serif text-[1.15rem]">
                    {s.name}
                    {!s.active && (
                      <span className="bg-mortar/50 ml-2 px-1.5 py-0.5 font-sans text-[0.8rem]">
                        hidden
                      </span>
                    )}
                  </p>
                  <p className="text-ash text-[0.85rem]">
                    <span className="capitalize">{s.tier.replace('-', ' ')}</span>
                    {s.url ? `. ${s.url}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.95rem]">
                    <label className={`${btnSecondary} cursor-pointer px-3 py-1.5 text-[0.9rem]`}>
                      {logoBusy === s.id ? 'Uploading' : s.logo ? 'Replace logo' : 'Upload logo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="sr-only"
                        onChange={(e) => upload(s, e.target.files?.[0] ?? null)}
                        disabled={logoBusy === s.id}
                      />
                    </label>
                    <button type="button" onClick={() => edit(s)} className={btnQuiet}>
                      Edit
                    </button>
                    <button type="button" onClick={() => remove(s)} className={btnMuted}>
                      Remove
                    </button>
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
