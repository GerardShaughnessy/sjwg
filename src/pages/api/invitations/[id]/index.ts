import type { APIRoute } from 'astro';
import { json, requireRole, route } from '@/server/http';
import { revoke } from '@/server/db/queries/invitations';

export const prerender = false;

export const DELETE: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  await revoke(ctx.params.id!);
  return json({ ok: true });
});
