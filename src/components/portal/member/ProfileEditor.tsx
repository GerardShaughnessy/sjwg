import { useEffect, useState } from 'react';
import type { Member } from '@/lib/types';
import { me } from '@/lib/api';
import MemberCard from '@/components/members/MemberCard';
import { btnPrimary, ErrorStrip, inputCls, Loading, msg, rebuildNote, Status } from '../ui';

type Draft = Omit<Member, 'id' | 'photo' | 'featured'> & { public: boolean };

/** A member edits his own directory row. Nothing is public until he says so. */
export default function ProfileEditor({ areas }: { areas: string[] }) {
  const [member, setMember] = useState<(Member & { public?: boolean }) | null | undefined>(
    undefined,
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    me.get()
      .then(({ member: m }) => {
        setMember(m);
        if (m)
          setDraft({
            name: m.name,
            trade: m.trade,
            areas: m.areas,
            yearsInTrade: m.yearsInTrade,
            bio: m.bio,
            availability: m.availability,
            public: Boolean((m as { public?: boolean }).public),
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
    setPending(true);
    setError('');
    setStatus('Saving.');
    try {
      const { member: saved, rebuild } = await me.updateProfile(draft);
      setMember(saved);
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
    ...draft,
  };

  return (
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
          <span className="font-semibold">Availability</span>
          <select
            value={draft.availability}
            onChange={(e) =>
              setDraft({ ...draft, availability: e.target.value as Member['availability'] })
            }
            className={inputCls}
          >
            <option value="available">Taking work</option>
            <option value="limited">Limited availability</option>
            <option value="unavailable">Not taking work right now</option>
          </select>
        </label>
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
              Your name, trade, areas, years, availability, and the line above. Nothing else. Untick
              to come off the public list.
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
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">Preview</h3>
        <div className="border-mortar mt-2 border-b">
          <MemberCard member={preview} />
        </div>
      </div>
    </div>
  );
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
