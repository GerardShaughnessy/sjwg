import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { db, hasDatabase } from '@/server/db/client';

export const prerender = false;

/** Used by deploy verification. Never leaks configuration beyond a boolean. */
export const GET: APIRoute = async () => {
  let database = false;
  if (hasDatabase()) {
    try {
      await db().execute(sql`select 1`);
      database = true;
    } catch {
      database = false;
    }
  }
  return new Response(JSON.stringify({ ok: true, database }), {
    status: database ? 200 : 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
};
