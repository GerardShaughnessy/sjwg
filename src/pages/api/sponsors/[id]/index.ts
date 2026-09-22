import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { sponsors } from '@/server/db/schema';
import { json, readJson, requireRole, route } from '@/server/http';
import { getSponsor, sponsorView } from '@/server/db/queries/sponsors';
import { parseOrThrow, sponsorSchema } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

export const PUT: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const before = await getSponsor(ctx.params.id!);
  const input = parseOrThrow(sponsorSchema, await readJson(ctx));
  const [row] = await db()
    .update(sponsors)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(sponsors.id, before.id))
    .returning();
  const rebuild =
    row.active || before.active ? await requestRebuild(`sponsor edited: ${row.name}`) : null;
  return json({ sponsor: sponsorView(row), rebuild });
});

export const DELETE: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const before = await getSponsor(ctx.params.id!);
  await db().delete(sponsors).where(eq(sponsors.id, before.id));
  const rebuild = before.active ? await requestRebuild(`sponsor removed: ${before.name}`) : null;
  return json({ ok: true, rebuild });
});
