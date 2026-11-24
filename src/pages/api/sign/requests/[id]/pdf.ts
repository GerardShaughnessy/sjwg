import type { APIRoute } from 'astro';
import { HttpError, requireSession, route } from '@/server/http';
import { getSignRequest, signedPdfResponse } from '@/server/esign';

export const prerender = false;

/** Officers, or the person the request was addressed to. */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const row = await getSignRequest(ctx.params.id!);
  const allowed =
    row &&
    (s.role === 'admin' ||
      (s.memberId && row.memberId === s.memberId) ||
      (row.userId && row.userId === s.userId));
  if (!row || !allowed) throw new HttpError(404, 'That signed copy was not found.');
  const res = await signedPdfResponse(row);
  if (!res) throw new HttpError(404, 'There is no signed PDF for this request yet.');
  return res;
});
