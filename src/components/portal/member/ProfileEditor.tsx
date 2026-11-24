import { useEffect, useState } from 'react';
import type { Member } from '@/lib/types';
import { me, members as membersApi } from '@/lib/api';
import MemberCard from '@/components/members/MemberCard';
import { directoryContact } from '@/lib/contact';
import { isEmail, isPhone } from '@/lib/validate';
import ServiceHours from './ServiceHours';
import { btnPrimary, ErrorStrip, inputCls, Loading, msg, rebuildNote, Status } from '../ui';

type Draft = Omit<Member, 'id' | 'photo' | 'featured'> & {
  public: boolean;
  showContact: boolean;
  publicEmail: string;
  publicPhone: string;
};
/** /api/me returns the whole row; these are the private fields the editor reads. */
type MeMember = Member & {
  public?: boolean;
  showContact?: boolean;
  privatePhone?: string | null;
  privateEmail?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
};

/** A member edits his own directory row. Nothing is public until he says so. */
export default function ProfileEditor({ areas }: { areas: string[] }) {
  const [member, setMember] = useState<MeMember | null | undefined>(undefined);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ContactErrors>({});

  useEffect(() => {
    me.get()
      .then(({ member }) => {
        const m = member as MeMember | null;
        setMember(m);
        if (m)
          setDraft({
            name: m.name,
            trade: m.trade,
            areas: m.areas,
            yearsInTrade: m.yearsInTrade,
            bio: m.bio,
            public: Boolean(m.public),
            showContact: Boolean(m.showContact),
            publicEmail: m.publicEmail ?? '',
            publicPhone: m.publicPhone ?? '',
          });
      })
      .catch((err) => {
        setMember(null);
        setError(msg(err, 'Could not load your entry.'));
      });
  }, []);

  if (member === undefined) return <Loading what="your entry" />;
  if (!member || !draft) {
    return (
      <div className="max-w-[56ch]">
        <h2 className="text-h2">Your directory entry</h2>
        <p className="mt-4 font-sans leading-relaxed">
          {error ||
            'Your account is not linked to a directory entry yet. Ask an officer to link it, then come back here.'}
        </p>
      </div>
    );
  }

  const allAreas = [...new Set([...areas, ...draft.areas])].sort((a, b) => a.localeCompare(b));
  const toggleArea = (a: string) =>
    setDraft(
      (d) =>
        d && {
          ...d,
          areas: d.areas.includes(a) ? d.areas.filter((x) => x !== a) : [...d.areas, a],
        },
    );

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const bad = contactErrors(draft);
    setFieldErrors(bad);
    if (bad.publicEmail || bad.publicPhone) {
      setStatus('');
      setError(bad.publicEmail || bad.publicPhone || '');
      return;
    }
    setPending(true);
    setError('');
    setStatus('Saving.');
    try {
      const { member: saved, rebuild } = await me.updateProfile(draft);
      setMember(saved as MeMember);
      setStatus(
        `Saved. ${draft.public ? rebuildNote(rebuild) || 'Your entry is public.' : 'Your entry stays private until you tick the box.'}`,
      );
    } catch (err) {
      setStatus('');
      setError(msg(err, 'Could not save.'));
    } finally {
      setPending(false);
    }
  }

  const preview: Member = {
    id: member.id,
    photo: member.photo,
    featured: member.featured,
    name: draft.name,
    trade: draft.trade,
    areas: draft.areas,
    yearsInTrade: draft.yearsInTrade,
    bio: draft.bio,
  };
  const { phone: myPhone, email: myEmail } = directoryContact({
    publicPhone: draft.publicPhone,
    publicEmail: draft.publicEmail,
    privatePhone: member.privatePhone,
    privateEmail: member.privateEmail,
  });
  const source = (pub: string) => (pub.trim() ? 'your public' : 'the private');
  const shownParts = [
    myPhone && `${myPhone} (${source(draft.publicPhone)} phone)`,
    myEmail && `${myEmail} (${source(draft.publicEmail)} email)`,
  ].filter(Boolean);
  const missing =
    !myPhone && !myEmail ? 'phone or email' : !myPhone ? 'phone' : !myEmail ? 'email' : '';
  const contactHint = [
    shownParts.length > 0 && `Visitors would see ${shownParts.join(' and ')}.`,
    missing && `No ${missing} is on file. Add a public one above.`,
  ]
    .filter(Boolean)
    .join(' ');

  async function changePhoto(file: File | null) {
    if (!file || !member) return;
    setPhotoBusy(true);
    setError('');
    try {
      const { member: saved, rebuild } = await membersApi.uploadPhoto(member.id, file);
      setMember({ ...member, photo: saved.photo });
      setStatus(`Photo saved. ${draft?.public ? rebuildNote(rebuild) : ''}`);
    } catch (err) {
      setError(msg(err, 'Could not upload the photo.'));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    if (!member) return;
    setPhotoBusy(true);
    try {
      const { member: saved } = await membersApi.removePhoto(member.id);
      setMember({ ...member, photo: saved.photo });
      setStatus('Photo removed.');
    } catch (err) {
      setError(msg(err, 'Could not remove the photo.'));
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-16">
      <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
        <form onSubmit={save} className="flex flex-col gap-6 font-sans">
          <h2 className="text-h2 font-serif">Your directory entry</h2>
          <p className="text-ash text-[0.95rem]">
            What appears publicly is your call. Nothing goes on the public directory until you tick
            the box at the bottom.
          </p>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Name as listed</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Trade</span>
            <input
              value={draft.trade}
              onChange={(e) => setDraft({ ...draft, trade: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Years in the trade</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.yearsInTrade}
              onChange={(e) => setDraft({ ...draft, yearsInTrade: Number(e.target.value) || 0 })}
              className={`${inputCls} w-32`}
            />
          </label>
          <fieldset>
            <legend className="font-semibold">Areas you serve</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {allAreas.map((a) => (
                <label key={a} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-brick h-5 w-5"
                    checked={draft.areas.includes(a)}
                    onChange={() => toggleArea(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
            <AddArea onAdd={(a) => setDraft({ ...draft, areas: [...draft.areas, a] })} />
          </fieldset>
          <label className="flex flex-col gap-1">
            <span className="font-semibold">One line in your own words</span>
            <textarea
              value={draft.bio}
              onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
              rows={3}
              maxLength={280}
              className={inputCls}
            />
          </label>
          <fieldset className="flex flex-col gap-4">
            <legend className="font-semibold">Contact for the directory</legend>
            <p className="text-ash text-[0.9rem]">
              Leave these blank to use the phone and email the Guild has on file. Your private phone
              and email stay with the Guild; an officer can change those for you.
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Public email (shown in the directory)</span>
              <input
                type="email"
                value={draft.publicEmail}
                onChange={(e) => setDraft({ ...draft, publicEmail: e.target.value })}
                aria-invalid={Boolean(fieldErrors.publicEmail)}
                className={inputCls}
              />
              {fieldErrors.publicEmail && (
                <span className="text-brick text-[0.95rem] font-semibold">
                  {fieldErrors.publicEmail}
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Public phone</span>
              <input
                type="tel"
                value={draft.publicPhone}
                onChange={(e) => setDraft({ ...draft, publicPhone: e.target.value })}
                aria-invalid={Boolean(fieldErrors.publicPhone)}
                className={`${inputCls} w-64`}
              />
              {fieldErrors.publicPhone && (
                <span className="text-brick text-[0.95rem] font-semibold">
                  {fieldErrors.publicPhone}
                </span>
              )}
            </label>
          </fieldset>
          <label className="border-brass bg-paper flex items-start gap-3 border-l-4 px-4 py-3">
            <input
              type="checkbox"
              className="accent-brick mt-1 h-5 w-5"
              checked={draft.public}
              onChange={(e) => setDraft({ ...draft, public: e.target.checked })}
            />
            <span>
              <span className="font-semibold">List me in the public directory.</span>
              <span className="text-ash block text-[0.9rem]">
                Your name, trade, areas, years, and the line above. Untick to come off the public
                list.
              </span>
            </span>
          </label>
          <label className="border-mortar flex items-start gap-3 border-l-4 px-4 py-3">
            <input
              type="checkbox"
              className="accent-brick mt-1 h-5 w-5"
              checked={draft.showContact}
              onChange={(e) => setDraft({ ...draft, showContact: e.target.checked })}
            />
            <span>
              <span className="font-semibold">
                Show my phone and email in the directory to visitors who affirm the directory terms
              </span>
              <span className="text-ash block text-[0.9rem]">
                {contactHint} Only shown while your entry is public.
              </span>
            </span>
          </label>
          {error && <ErrorStrip>{error}</ErrorStrip>}
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={pending} className={btnPrimary}>
              Save entry
            </button>
            <Status>{status}</Status>
          </div>
        </form>
        <div>
          <h3 className="text-brass-ink font-sans text-[0.95rem] font-semibold">Preview</h3>
          <div className="border-mortar mt-2 border-b">
            <MemberCard
              member={preview}
              contact={draft.showContact ? { phone: myPhone, email: myEmail } : null}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4 font-sans">
            <label className="border-charcoal hover:bg-charcoal hover:text-stone cursor-pointer border-2 px-4 py-2 font-semibold">
              {photoBusy ? 'Working' : member.photo ? 'Replace your photo' : 'Add your photo'}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => changePhoto(e.target.files?.[0] ?? null)}
                disabled={photoBusy}
              />
            </label>
            {member.photo && (
              <button
                type="button"
                onClick={removePhoto}
                disabled={photoBusy}
                className="text-ash decoration-mortar font-medium underline decoration-2 underline-offset-4"
              >
                Remove photo
              </button>
            )}
            <span className="text-ash text-[0.9rem]">
              A square headshot works best. Photos are resized before upload.
            </span>
          </div>
        </div>
      </div>
      <div className="border-mortar border-t pt-10">
        <ServiceHours />
      </div>
    </div>
  );
}

type ContactErrors = { publicEmail?: string; publicPhone?: string };

function contactErrors(d: { publicEmail: string; publicPhone: string }): ContactErrors {
  const out: ContactErrors = {};
  if (d.publicEmail.trim() && !isEmail(d.publicEmail))
    out.publicEmail = 'That email does not look right, like name@example.com.';
  if (d.publicPhone.trim() && !isPhone(d.publicPhone))
    out.publicPhone = 'Ten digits with area code.';
  return out;
}

function AddArea({ onAdd }: { onAdd: (a: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="mt-3 flex gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Another area"
        className={`${inputCls} w-48`}
        aria-label="Another area you serve"
      />
      <button
        type="button"
        onClick={() => {
          if (v.trim()) onAdd(v.trim());
          setV('');
        }}
        className="border-charcoal hover:bg-charcoal hover:text-stone border-2 px-3 py-2 font-semibold"
      >
        Add
      </button>
    </div>
  );
}
