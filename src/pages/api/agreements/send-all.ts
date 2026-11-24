import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { json, readJson, requireSiteAdmin, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { sendAgreementToAll } from '@/server/agreements';
import { ACCOUNT_DOC_KINDS } from '@/config/documents';

export const prerender = false;

const schema = z.object({
  kind: z.enum(ACCOUNT_DOC_KINDS as [string, ...string[]], { message: 'Pick an agreement.' }),
});

/** Send (or send a fresh link) to everyone who needs this agreement and has not signed. Admin only. */
export const POST: APIRoute = route(async (ctx) => {
  const by = requireSiteAdmin(ctx);
  const input = parseOrThrow(schema, await readJson(ctx));
  return json(await sendAgreementToAll(input.kind as 'officer-agreement', by));
});
