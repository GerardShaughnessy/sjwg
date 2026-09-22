import type { APIRoute } from 'astro';
import { db } from '@/server/db/client';
import { sponsors } from '@/server/db/schema';
import { json, readJson, requireRole, route } from '@/server/http';
import { listSponsors, sponsorView } from '@/server/db/queries/sponsors';
import { parseOrThrow, sponsorSchema } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  const admin = ctx.locals.session?.role === 'admin';
  return json({ sponsors: await listSponsors(admin) }, 200, {
    'cache-control': admin ? 'no-store' : 'public, max-age=60',
  });
});

export const POST: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const input = parseOrThrow(sponsorSchema, await readJson(ctx));
  const [row] = await db().insert(sponsors).values(input).returning();
  const rebuild = row.active ? await requestRebuild(`sponsor added: ${row.name}`) : null;
  return json({ sponsor: sponsorView(row), rebuild }, 201);
});
