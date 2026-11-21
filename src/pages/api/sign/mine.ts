import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { requestsForMember } from '@/server/esign';

export const prerender = false;

/** The logged-in tradesman's own paperwork: open requests to sign and signed copies. */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  return json({ requests: s.memberId ? await requestsForMember(s.memberId) : [] });
});
