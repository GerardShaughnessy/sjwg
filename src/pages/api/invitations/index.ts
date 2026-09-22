import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import { invite, listInvitations } from '@/server/db/queries/invitations';
import { invitationSchema, parseOrThrow } from '@/server/schemas';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  return json({ invitations: await listInvitations() });
});

export const POST: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const input = parseOrThrow(invitationSchema, await readJson(ctx));
  const { row, emailed, mailError, token } = await invite(input, by);
  // The raw link is returned once so an officer can hand it over if email fails.
  return json({ id: row.id, email: row.email, emailed, mailError, link: `/invite/${token}` }, 201);
});
