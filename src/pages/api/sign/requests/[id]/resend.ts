import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { resendSignRequest, toView } from '@/server/esign';

export const prerender = false;

export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const out = await resendSignRequest(ctx.params.id!, by);
  return json({
    request: toView(out.row),
    emailed: out.emailed,
    mailError: out.mailError,
    link: out.link,
  });
});
