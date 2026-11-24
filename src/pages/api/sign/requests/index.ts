import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { sendForSignatureSchema } from '@/server/esign-schemas';
import { listSignRequests, sendForSignature, toView } from '@/server/esign';
import { canSeeSignRequest } from '@/server/agreement-rules';
import type { SignDocKind } from '@/config/documents';

export const prerender = false;

/** Officers. Officer and board agreements are listed only for the Admin (and the signer's own). */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireRole(ctx, 'admin');
  const memberId = ctx.url.searchParams.get('memberId') || undefined;
  const requests = await listSignRequests({ memberId });
  return json({ requests: requests.filter((r) => canSeeSignRequest(s, r)) });
});

export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const input = parseOrThrow(sendForSignatureSchema, await readJson(ctx));
  const out = await sendForSignature({
    docKind: input.docKind as SignDocKind,
    memberId: input.memberId ?? null,
    name: input.name,
    email: input.email,
    sentBy: by,
  });
  // The raw link is returned once so an officer can hand it over if email fails.
  return json(
    { request: toView(out.row), emailed: out.emailed, mailError: out.mailError, link: out.link },
    201,
  );
});
