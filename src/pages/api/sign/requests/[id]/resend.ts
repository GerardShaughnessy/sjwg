import type { APIRoute } from 'astro';
import { HttpError, json, requireRole, route } from '@/server/http';
import { getSignRequest, resendSignRequest, toView } from '@/server/esign';
import { resendAgreement } from '@/server/agreements';
import { isAccountDocKind } from '@/config/documents';

export const prerender = false;

/**
 * Officers resend tradesman paperwork; only the Admin resends an officer or
 * board agreement (by kind, so one whose account was deleted stays Admin-only).
 * An agreement whose person changed is voided and sent fresh with the current
 * text; `replaced` and `message` say so.
 */
export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const row = await getSignRequest(ctx.params.id!);
  if (!row) throw new HttpError(404, 'That signature request was not found.');
  if (isAccountDocKind(row.docKind)) {
    if (!by.siteAdmin)
      throw new HttpError(403, 'Only the Admin can change an officer or board agreement.');
    const out = await resendAgreement(row.id, by);
    return json({
      request: toView(out.row),
      emailed: out.emailed,
      mailError: out.mailError,
      link: out.link,
      replaced: out.replaced,
      message: out.message,
    });
  }
  const out = await resendSignRequest(row.id, by);
  return json({
    request: toView(out.row),
    emailed: out.emailed,
    mailError: out.mailError,
    link: out.link,
    replaced: false,
    message: null,
  });
});
