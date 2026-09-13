import { useState } from 'react';
import { posts } from '@/lib/store';
import { useStoreVersion } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';

/** Draft blog posts. Saved to this browser only; publishing is a later step. */
export default function PostEditor() {
  useStoreVersion();
  const drafts = posts.list();
  const [id, setId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);

  function edit(d: { id: string; title: string; body: string }) {
    setId(d.id);
    setTitle(d.title);
    setBody(d.body);
    setStatus(`Editing "${d.title}".`);
  }
  function reset() {
    setId(undefined);
    setTitle('');
    setBody('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setStatus('Give the post a title first.');
      return;
    }
    setPending(true);
    setStatus('Saving draft.');
    try {
      const saved = await posts.save({ id, title: title.trim(), body });
      setId(saved.id);
      setStatus('Draft saved.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <form onSubmit={save} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">{id ? 'Edit post' : 'New post'}</h2>
        <p className="text-ash text-[0.95rem]">
          Plain text or markdown. Drafts stay in this browser. Publishing to the blog is not wired
          yet.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border-charcoal bg-paper border-2 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="border-charcoal bg-paper border-2 px-3 py-2 font-serif text-[1.05rem] leading-relaxed"
          />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={pending}
            className="bg-brick text-paper hover:bg-kiln px-5 py-3 font-semibold disabled:opacity-60"
          >
            Save draft
          </button>
          {id && (
            <button
              type="button"
              onClick={reset}
              className="decoration-brass font-medium underline decoration-2 underline-offset-4"
            >
              Start a new post
            </button>
          )}
          <p role="status" aria-live="polite" className="text-ash text-[0.9rem]">
            {status}
          </p>
        </div>
      </form>
      <div>
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">Drafts</h3>
        {drafts.length === 0 ? (
          <p className="text-ash mt-2">No drafts yet.</p>
        ) : (
          <ul className="border-mortar mt-2 border-t font-sans">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="border-mortar flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <div>
                  <p className="font-serif text-[1.15rem]">{d.title}</p>
                  <p className="text-ash text-[0.85rem]">Updated {formatShortDate(d.updatedAt)}</p>
                </div>
                <div className="flex gap-4 text-[0.95rem]">
                  <button
                    type="button"
                    onClick={() => edit(d)}
                    className="decoration-brass font-medium underline decoration-2 underline-offset-4"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => posts.remove(d.id)}
                    className="text-ash decoration-mortar font-medium underline decoration-2 underline-offset-4"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
