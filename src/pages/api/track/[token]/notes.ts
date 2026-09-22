import type { APIRoute } from 'astro';
import { badRequest, json, rateLimit, readJson, route } from '@/server/http';
import { addRequesterNote, findByToken } from '@/server/track';
import { noteSchema, parseOrThrow } from '@/server/schemas';

export const prerender = false;

export const POST: APIRoute = route(async (ctx) => {
  const token = ctx.params.token ?? '';
  const req = await findByToken(token);
  if (!rateLimit(`track:${req.id}`, 3, 60 * 60 * 1000))
    throw badRequest('Three notes an hour is the limit. Try again a little later.');
  const { body } = parseOrThrow(noteSchema.pick({ body: true }), await readJson(ctx));
  const note = await addRequesterNote(req, body);
  return json({ note }, 201);
});
