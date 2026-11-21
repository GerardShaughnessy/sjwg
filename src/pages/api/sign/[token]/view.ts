import type { APIRoute } from 'astro';
import { clientIp, json, rateLimit, route } from '@/server/http';
import { findByToken, recordView } from '@/server/esign';
import { linkState } from '@/server/esign-core';

export const prerender = false;

/** The signer's browser opened the signing page. Records the first view only. */
export const POST: APIRoute = route(async (ctx) => {
  const ip = clientIp(ctx);
  if (!rateLimit(`sign-view:${ip ?? 'none'}`, 30, 10 * 60 * 1000)) return json({ ok: true });
  const row = await findByToken(ctx.params.token ?? '');
  if (row && linkState(row) === 'open')
    await recordView(row, {
      actor: row.signerName,
      ip,
      userAgent: ctx.request.headers.get('user-agent'),
      meta: { via: 'link' },
    });
  return json({ ok: true });
});
