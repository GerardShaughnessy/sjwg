import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import { postView, setPublished } from '@/server/db/queries/posts';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

/** Officers publish and unpublish. Both trigger a rebuild so the public blog updates. */
export const POST: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const body = (await readJson<{ publish?: boolean }>(ctx).catch(() => ({}))) as {
    publish?: boolean;
  };
  const publish = body.publish !== false;
  const row = await setPublished(ctx.params.id!, publish);
  const rebuild = await requestRebuild(`${publish ? 'published' : 'unpublished'}: ${row.title}`);
  return json({ post: postView(row), rebuild });
});
