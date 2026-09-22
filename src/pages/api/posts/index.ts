import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import { createPost, listPosts, postView } from '@/server/db/queries/posts';
import { parseOrThrow, postSchema } from '@/server/schemas';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) =>
  json({ posts: await listPosts(requireSession(ctx)) }),
);

export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const input = parseOrThrow(postSchema, await readJson(ctx));
  return json({ post: postView(await createPost(input, session)) }, 201);
});
