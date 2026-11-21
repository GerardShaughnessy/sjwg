import type { APIRoute } from 'astro';
import { HttpError, route } from '@/server/http';
import { findByToken, signedPdfResponse } from '@/server/esign';

export const prerender = false;

/** The signed copy, for whoever holds the link, once it is signed. */
export const GET: APIRoute = route(async (ctx) => {
  const row = await findByToken(ctx.params.token ?? '');
  if (!row || !row.signedAt) throw new HttpError(404, 'There is no signed copy for this link yet.');
  const res = await signedPdfResponse(row);
  if (!res)
    throw new HttpError(
      404,
      'The signed copy is not ready. The Guild has been told; check your email for it.',
    );
  return res;
});
