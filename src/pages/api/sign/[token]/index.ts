import type { APIRoute } from 'astro';
import { HttpError, clientIp, json, rateLimit, readJson, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { signSchema } from '@/server/esign-schemas';
import { assertAgreementStillApplies } from '@/server/agreements';
import { completeSignature, findByToken } from '@/server/esign';

export const prerender = false;

/**
 * Public: the emailed link is the only access control. Signs once, only the
 * exact document the signer was shown (docSha256 must match the frozen hash).
 */
export const POST: APIRoute = route(async (ctx) => {
  const ip = clientIp(ctx);
  if (!rateLimit(`sign:${ip ?? 'unknown'}`, 20, 15 * 60 * 1000))
    throw new HttpError(429, 'Too many tries. Wait a few minutes and try again.');
  const row = await findByToken(ctx.params.token ?? '');
  if (!row)
    throw new HttpError(404, 'This signing link is not right. Ask the Guild to send a new one.');
  // An officer or board agreement for someone no longer in that role: 410.
  await assertAgreementStillApplies(row);
  const input = parseOrThrow(signSchema, await readJson(ctx));
  const out = await completeSignature(row, input, {
    ip,
    userAgent: ctx.request.headers.get('user-agent'),
    via: 'link',
    actor: input.signedName,
  });
  return json({
    ok: true,
    signedAt: out.row.signedAt?.toISOString(),
    hasPdf: out.pdfStored,
    emailed: out.emailed,
  });
});
