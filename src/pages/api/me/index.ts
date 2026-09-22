import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { members } from '@/server/db/schema';
import { json, requireSession, route } from '@/server/http';

export const prerender = false;

/** Who am I. The middleware already refused anyone without a Guild account. */
export const GET: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const member = session.memberId
    ? ((await db().select().from(members).where(eq(members.id, session.memberId)).limit(1))[0] ??
      null)
    : null;
  return json({ session, member });
});
