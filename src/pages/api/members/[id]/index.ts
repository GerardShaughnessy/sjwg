import type { APIRoute } from 'astro';
import { json, readJson, requireRole, route } from '@/server/http';
import { deleteMember, getMember, memberView, updateMember } from '@/server/db/queries/members';
import { memberAdminSchema, parseOrThrow } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

export const PUT: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const before = await getMember(ctx.params.id!);
  const input = parseOrThrow(memberAdminSchema, await readJson(ctx));
  const row = await updateMember(before.id, input);
  const rebuild =
    row.public || before.public ? await requestRebuild(`member edited: ${row.name}`) : null;
  return json({ member: memberView(row), rebuild });
});

export const DELETE: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const row = await deleteMember(ctx.params.id!);
  const rebuild = row.public ? await requestRebuild(`member removed: ${row.name}`) : null;
  return json({ ok: true, rebuild });
});
