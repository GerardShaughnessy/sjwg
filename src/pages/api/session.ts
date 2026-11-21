import type { APIRoute } from 'astro';
import { json, route } from '@/server/http';

export const prerender = false;

/** Whether this browser is signed in, so the site header can offer Log Out. */
export const GET: APIRoute = route(async (ctx) =>
  json({ signedIn: Boolean(ctx.locals.session) }),
);
