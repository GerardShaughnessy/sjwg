import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { resend } from '@/server/db/queries/invitations';

export const prerender = false;

export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const { row, emailed, mailError, token } = await resend(ctx.params.id!, by);
  return json({ id: row.id, emailed, mailError, link: `/invite/${token}` });
});
