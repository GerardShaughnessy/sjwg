import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import { deletePost, postView, updatePost } from '@/server/db/queries/posts';
import { parseOrThrow, postSchema } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

export const PUT: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const input = parseOrThrow(postSchema, await readJson(ctx));
  const row = await updatePost(ctx.params.id!, input, session);
  const rebuild =
    row.status === 'published' ? await requestRebuild(`post edited: ${row.title}`) : null;
  return json({ post: postView(row), rebuild });
});

export const DELETE: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const wasPublished = await deletePost(ctx.params.id!, session);
  const rebuild = wasPublished ? await requestRebuild('post deleted') : null;
  return json({ ok: true, rebuild });
});
