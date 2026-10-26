import type { APIRoute } from 'astro';
import { badRequest, HttpError, json, readJson, requireSession, route } from '@/server/http';
import { addHours, hoursView, listHours, memberExists } from '@/server/db/queries/hours';
import { parseOrThrow, serviceHoursSchema } from '@/server/schemas';
import { canManageHours } from '@/server/hours';

export const prerender = false;

function yearParam(url: URL) {
  const y = Number(url.searchParams.get('year') ?? new Date().getFullYear());
  if (!Number.isInteger(y) || y < 2020 || y > 2100)
    throw badRequest('That year does not look right.');
  return y;
}

/** ?member=<id>&year=2026. Without member, the caller's own entry. */
export const GET: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const memberId = ctx.url.searchParams.get('member') || session.memberId;
  if (!memberId)
    throw new HttpError(
      409,
      'Your account is not linked to a directory entry yet. Ask an officer.',
    );
  if (!canManageHours(session, memberId)) throw new HttpError(403, 'Those hours are not yours.');
  return json({ hours: await listHours(memberId, yearParam(ctx.url)) });
});

export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const input = parseOrThrow(serviceHoursSchema, await readJson(ctx));
  const memberId = input.memberId ?? session.memberId;
  if (!memberId)
    throw new HttpError(
      409,
      'Your account is not linked to a directory entry yet. Ask an officer.',
    );
  if (!canManageHours(session, memberId)) throw new HttpError(403, 'Those hours are not yours.');
  await memberExists(memberId);
  const row = await addHours({ ...input, memberId }, session.userId);
  return json({ entry: hoursView({ ...row, loggedByName: session.name }) }, 201);
});
