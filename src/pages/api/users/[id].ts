import type { APIRoute } from 'astro';
import { json, readJson, requireSiteAdmin, route } from '@/server/http';
import { getUser, updateUser } from '@/server/db/queries/users';
import { parseOrThrow, userPatchSchema } from '@/server/schemas';
import { assertUserPatchAllowed } from '@/server/permissions';

export const prerender = false;

/** Make or remove an officer, set a title, disable or enable, set the Admin flag. Admin only. */
export const PATCH: APIRoute = route(async (ctx) => {
  const actor = requireSiteAdmin(ctx);
  const patch = parseOrThrow(userPatchSchema, await readJson(ctx));
  const target = await getUser(ctx.params.id!);
  assertUserPatchAllowed(actor, target, patch);
  return json({ user: await updateUser(target.id, patch) });
});
