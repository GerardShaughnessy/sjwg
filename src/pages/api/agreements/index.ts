import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { json, readJson, requireSiteAdmin, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { allAgreementStatuses, sendAgreement } from '@/server/agreements';
import { ACCOUNT_DOC_KINDS } from '@/config/documents';

export const prerender = false;

const sendSchema = z.object({
  kind: z.enum(ACCOUNT_DOC_KINDS as [string, ...string[]], { message: 'Pick an agreement.' }),
  userId: z.string().uuid('Pick someone.'),
});

/** Where every officer and director stands on their agreement. Admin only. */
export const GET: APIRoute = route(async (ctx) => {
  requireSiteAdmin(ctx);
  return json({ statuses: await allAgreementStatuses() });
});

/** Send one officer or board agreement, with the person's title and duties merged in. Admin only. */
export const POST: APIRoute = route(async (ctx) => {
  const by = requireSiteAdmin(ctx);
  const input = parseOrThrow(sendSchema, await readJson(ctx));
  const out = await sendAgreement(input.kind as 'officer-agreement', input.userId, by);
  return json(out, 201);
});
