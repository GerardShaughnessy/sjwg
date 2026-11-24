import type { APIRoute } from 'astro';
import { HttpError, json, requireRole, route } from '@/server/http';
import { getSignRequest, toView, voidSignRequest } from '@/server/esign';
import { isAccountDocKind } from '@/config/documents';

export const prerender = false;

/**
 * Officers void tradesman paperwork; only the Admin voids an officer or board
 * agreement (by kind, so one whose account was deleted stays Admin-only).
 */
export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const row = await getSignRequest(ctx.params.id!);
  if (row && isAccountDocKind(row.docKind) && !by.siteAdmin)
    throw new HttpError(403, 'Only the Admin can change an officer or board agreement.');
  return json({ request: toView(await voidSignRequest(ctx.params.id!, by)) });
});
