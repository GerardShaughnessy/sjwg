import { useState } from 'react';
import type { Session } from '@/lib/types';
import { posts, type PostView } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { formatShortDate } from '@/lib/events';
import {
  btnMuted,
  btnPrimary,
  btnQuiet,
  ErrorStrip,
  inputCls,
  Loading,
  msg,
  rebuildNote,
  Status,
} from '../ui';

/** Blog posts. Members draft; officers publish, and the public blog rebuilds. */
export default function PostEditor({ session }: { session: Session }) {
  const { data, loading, error } = useResource(() => posts.list(), []);
  const [id, setId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('');
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);
  const isAdmin = session.role === 'admin';

  function edit(p: PostView) {
    setId(p.id);
    setTitle(p.title);
    setDescription(p.description);
    setBody(p.body);
    setStatus(`Editing "${p.title}".`);
    setFormError('');
  }
  function reset() {
    setId(undefined);
    setTitle('');
    setDescription('');
    setBody('');
    setStatus('');
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setPending(true);
    setStatus('Saving.');
    try {
      const saved = await posts.save({
        id,
        title: title.trim(),
        description: description.trim(),
        body,
      });
      setId(saved.id);
      setStatus(
        saved.status === 'published'
          ? 'Saved. The public site will update shortly.'
          : 'Draft saved.',
      );
    } catch (err) {
      setStatus('');
      setFormError(msg(err, 'Could not save.'));
    } finally {
      setPending(false);
    }
  }
  async function publish(p: PostView, on: boolean) {
    try {
      const { rebuild } = await posts.publish(p.id, on);
      setStatus(`${on ? 'Published' : 'Unpublished'} "${p.title}". ${rebuildNote(rebuild)}`);
    } catch (err) {
      setFormError(msg(err, 'Could not change that.'));
    }
  }
  async function remove(p: PostView) {
    try {
      await posts.remove(p.id);
      if (id === p.id) reset();
      setStatus(`Deleted "${p.title}".`);
    } catch (err) {
      setFormError(msg(err, 'Could not delete that.'));
    }
  }

  const list = data ?? [];
  const canEdit = (p: PostView) =>
    isAdmin || (p.authorUserId === session.userId && p.status === 'draft');

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <form onSubmit={save} className="flex flex-col gap-5 font-sans">
        <h2 className="text-h2 font-serif">{id ? 'Edit post' : 'New post'}</h2>
        <p className="text-ash text-[0.95rem]">
          Plain text or markdown.{' '}
          {isAdmin
            ? 'Publish from the list on the right; the public blog rebuilds within a few minutes.'
            : 'Save a draft and an officer will publish it.'}
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">One-line summary</span>
          <span className="text-ash text-[0.9rem]">
            Shown on the blog list and in search results.
          </span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={14}
            className={`${inputCls} font-serif text-[1.05rem] leading-relaxed`}
          />
        </label>
        {formError && <ErrorStrip>{formError}</ErrorStrip>}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={btnPrimary}>
            {id ? 'Save changes' : 'Save draft'}
          </button>
          {id && (
            <button type="button" onClick={reset} className={btnQuiet}>
              Start a new post
            </button>
          )}
          <Status>{status}</Status>
        </div>
      </form>
      <div>
        <h3 className="text-brass font-sans text-[0.95rem] font-semibold">Posts</h3>
        {error && (
          <div className="mt-2">
            <ErrorStrip>{error}</ErrorStrip>
          </div>
        )}
        {loading && !data && (
          <div className="mt-2">
            <Loading what="posts" />
          </div>
        )}
        {data && list.length === 0 && <p className="text-ash mt-2">No posts yet.</p>}
        {list.length > 0 && (
          <ul className="border-mortar mt-2 border-t font-sans">
            {list.map((p) => (
              <li
                key={p.id}
                className="border-mortar flex flex-wrap items-baseline justify-between gap-3 border-b py-3"
              >
                <div>
                  <p className="font-serif text-[1.15rem]">
                    {p.status === 'published' ? (
                      <a href={`/blog/${p.slug}`} className="no-underline hover:underline">
                        {p.title}
                      </a>
                    ) : (
                      p.title
                    )}
                  </p>
                  <p className="text-ash text-[0.85rem]">
                    {p.status === 'published'
                      ? `Published ${p.pubDate ? formatShortDate(p.pubDate) : ''}`
                      : 'Draft'}
                    {p.authorName ? ` by ${p.authorName}` : ''}. Updated{' '}
                    {formatShortDate(p.updatedAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-[0.95rem]">
                  {canEdit(p) && (
                    <button type="button" onClick={() => edit(p)} className={btnQuiet}>
                      Edit
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => publish(p, p.status !== 'published')}
                      className={btnQuiet}
                    >
                      {p.status === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                  )}
                  {canEdit(p) && (
                    <button type="button" onClick={() => remove(p)} className={btnMuted}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
