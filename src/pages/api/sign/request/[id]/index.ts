import type { APIRoute } from 'astro';
import { HttpError, clientIp, json, readJson, requireSession, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { signSchema } from '@/server/esign-schemas';
import { assertAgreementStillApplies } from '@/server/agreements';
import { completeSignature, getSignRequest } from '@/server/esign';
import { assertCanSignInPortal } from '@/server/agreement-rules';

export const prerender = false;

/**
 * A logged-in person signs their own request: a tradesman's, addressed to
 * their directory entry, or an officer's or director's, sent to their account.
 */
export const POST: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const row = await getSignRequest(ctx.params.id ?? '');
  if (!row) throw new HttpError(404, 'That paperwork was not found.');
  assertCanSignInPortal(s, row);
  // An officer or board agreement for someone no longer in that role: 410.
  await assertAgreementStillApplies(row);
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
