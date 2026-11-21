import type { APIRoute } from 'astro';
import { HttpError, clientIp, json, readJson, requireSession, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { signSchema } from '@/server/esign-schemas';
import { completeSignature, getSignRequest } from '@/server/esign';

export const prerender = false;

/** A logged-in tradesman signs a request addressed to his own directory entry. */
export const POST: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const row = await getSignRequest(ctx.params.id ?? '');
  if (!row || !s.memberId || row.memberId !== s.memberId)
    throw new HttpError(404, 'That paperwork was not found.');
  const input = parseOrThrow(signSchema, await readJson(ctx));
  const out = await completeSignature(row, input, {
    ip: clientIp(ctx),
    userAgent: ctx.request.headers.get('user-agent'),
    via: 'portal',
    actor: input.signedName,
  });
  return json({
    ok: true,
    signedAt: out.row.signedAt?.toISOString(),
    hasPdf: out.pdfStored,
    emailed: out.emailed,
  });
});
