import type { APIRoute } from 'astro';
import { json, readJson, requireRole, requireSession, route } from '@/server/http';
import {
  createMember,
  listMembersAdmin,
  listMembersBrief,
  memberView,
} from '@/server/db/queries/members';
import { parseOrThrow } from '@/server/schemas';
import { memberUpdateSchema } from '@/server/directory';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

/** Officers get the full roster; members get names and trades for referrals. */
export const GET: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  if (session.role === 'admin') return json({ members: await listMembersAdmin() });
  return json({ members: await listMembersBrief() });
});

export const POST: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const input = parseOrThrow(memberUpdateSchema, await readJson(ctx));
  const row = await createMember(input);
  const rebuild = row.public ? await requestRebuild(`member added: ${row.name}`) : null;
  return json({ member: memberView(row), rebuild }, 201);
});
