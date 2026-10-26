import type { APIRoute } from 'astro';
import { HttpError, json, requireSession, route } from '@/server/http';
import { deleteHours, getHours } from '@/server/db/queries/hours';
import { canManageHours } from '@/server/hours';

export const prerender = false;

export const DELETE: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const row = await getHours(ctx.params.id!);
  if (!canManageHours(session, row.memberId)) throw new HttpError(403, 'That entry is not yours.');
  await deleteHours(row.id);
  return json({ ok: true });
});
