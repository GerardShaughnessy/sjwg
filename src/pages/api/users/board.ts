import type { APIRoute } from 'astro';
import { json, requireBoardAccess, route } from '@/server/http';
import { listBoard } from '@/server/db/queries/users';

export const prerender = false;

/** The Board page: every enabled director. Officers and directors can read it. */
export const GET: APIRoute = route(async (ctx) => {
  requireBoardAccess(ctx);
  return json({ board: await listBoard() });
});
