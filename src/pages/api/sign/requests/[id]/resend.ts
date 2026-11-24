import type { APIRoute } from 'astro';
import { HttpError, json, requireRole, route } from '@/server/http';
import { getSignRequest, resendSignRequest, toView } from '@/server/esign';

export const prerender = false;

/** Officers resend tradesman paperwork; only the Admin resends an officer or board agreement. */
export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const row = await getSignRequest(ctx.params.id!);
  if (row?.userId && !by.siteAdmin)
    throw new HttpError(403, 'Only the Admin can change an officer or board agreement.');
  const out = await resendSignRequest(ctx.params.id!, by);
  return json({
    request: toView(out.row),
    emailed: out.emailed,
    mailError: out.mailError,
    link: out.link,
  });
});
