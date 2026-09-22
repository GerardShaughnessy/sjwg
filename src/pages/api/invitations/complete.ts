import type { APIRoute } from 'astro';
import { HttpError, json, readJson, route } from '@/server/http';
import { getAuthSession } from '@/server/auth/server';
import { complete } from '@/server/db/queries/invitations';
import { acceptInviteSchema, parseOrThrow } from '@/server/schemas';

export const prerender = false;

/**
 * Called right after sign-up, with the fresh session cookie. The caller has a
 * Better Auth identity but no Guild account yet, so this route is not behind
 * the app-session gate; it checks the upstream session itself.
 */
export const POST: APIRoute = route(async (ctx) => {
  const { token } = parseOrThrow(acceptInviteSchema, await readJson(ctx));
  const upstream = await getAuthSession(ctx);
  if (!upstream?.user)
    throw new HttpError(
      401,
      'Your sign-up did not finish. Reload the invitation link and try again.',
    );
  const user = await complete(token, {
    id: upstream.user.id,
    email: upstream.user.email,
    name: upstream.user.name,
  });
  return json({ ok: true, role: user.role });
});
