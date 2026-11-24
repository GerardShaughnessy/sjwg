import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { myAgreements } from '@/server/agreements';

export const prerender = false;

/** The logged-in officer's or director's own agreements and where each stands. */
export const GET: APIRoute = route(async (ctx) => {
  return json({ agreements: await myAgreements(requireSession(ctx)) });
});
