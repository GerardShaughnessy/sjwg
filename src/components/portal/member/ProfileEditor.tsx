import { useState } from 'react';
import type { Member } from '@/lib/types';
import { profile } from '@/lib/store';
import { useStoreVersion } from '@/lib/hooks';
import MemberCard from '@/components/members/MemberCard';

/** A member edits his own directory entry. Changes override the seed for this browser. */
export default function ProfileEditor({ base, areas }: { base: Member; areas: string[] }) {
  useStoreVersion();
  const current = profile.get(base.id, base);
  const [draft, setDraft] = useState<Member>(current);
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus('Saving.');
    try {
      await profile.update(base.id, draft);
      setStatus('Saved. This is how your entry reads now.');
    } finally {
      setPending(false);
    }
  }

  const toggleArea = (a: string) =>
    setDraft((d) => ({
      ...d,
      areas: d.areas.includes(a) ? d.areas.filter((x) => x !== a) : [...d.areas, a],
    }));

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <form onSubmit={save} className="flex flex-col gap-6 font-sans">
        <h2 className="text-h2 font-serif">Your directory entry</h2>
        <p className="text-ash text-[0.95rem]">
          What appears publicly is your call. Nothing here goes live until you agree to it.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Name as listed</span>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="border-charcoal bg-paper border-2 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Trade</span>
          <input
            value={draft.trade}
            onChange={(e) => setDraft({ ...draft, trade: e.target.value })}
            className="border-charcoal bg-paper border-2 px-3 py-2"
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
            className="border-charcoal bg-paper w-32 border-2 px-3 py-2"
          />
        </label>
        <fieldset>
          <legend className="font-semibold">Areas you serve</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {areas.map((a) => (
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
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Availability</span>
          <select
            value={draft.availability}
            onChange={(e) =>
              setDraft({ ...draft, availability: e.target.value as Member['availability'] })
            }
            className="border-charcoal bg-paper border-2 px-3 py-2"
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
            className="border-charcoal bg-paper border-2 px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="bg-brick text-paper hover:bg-kiln px-5 py-3 font-semibold disabled:opacity-60"
          >
            Save entry
          </button>
          <p role="status" aria-live="polite" className="text-ash text-[0.9rem]">
            {status}
          </p>
        </div>
      </form>
      <div>
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">Preview</h3>
        <div className="border-mortar mt-2 border-b">
          <MemberCard member={draft} />
        </div>
      </div>
    </div>
  );
}
