import type { APIRoute } from 'astro';
import { HttpError, requireSession, route } from '@/server/http';
import { getSignRequest, signedPdfResponse } from '@/server/esign';
import { canSeeSignRequest } from '@/server/agreement-rules';

export const prerender = false;

/**
 * Tradesman paperwork: officers, or the tradesman it was addressed to.
 * Officer and board agreements: the Admin, or the person who signed.
 */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const row = await getSignRequest(ctx.params.id!);
  if (!row || !canSeeSignRequest(s, row))
    throw new HttpError(404, 'That signed copy was not found.');
  const res = await signedPdfResponse(row);
  if (!res) throw new HttpError(404, 'There is no signed PDF for this request yet.');
  return res;
});
