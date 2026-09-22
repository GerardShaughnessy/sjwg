import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { members } from '@/server/db/schema';
import { HttpError, json, readJson, requireSession, route } from '@/server/http';
import { parseOrThrow, profileSchema } from '@/server/schemas';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

/** A member edits only his own directory row. `public` is the consent gate. */
export const PUT: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  if (!session.memberId)
    throw new HttpError(
      409,
      'Your account is not linked to a directory entry yet. Ask an officer.',
    );
  const input = parseOrThrow(profileSchema, await readJson(ctx));
  const d = db();
  const [before] = await d
    .select({ public: members.public })
    .from(members)
    .where(eq(members.id, session.memberId))
    .limit(1);
  const [row] = await d
    .update(members)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(members.id, session.memberId))
    .returning();
  if (!row) throw new HttpError(404, 'Your directory entry was not found.');
  let rebuild: string | null = null;
  if (row.public || before?.public) rebuild = await requestRebuild(`profile: ${row.name}`);
  return json({ member: row, rebuild });
});
