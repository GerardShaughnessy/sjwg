import type { APIRoute } from 'astro';
import { json, route } from '@/server/http';
import { loadTracked } from '@/server/track';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  const view = await loadTracked(ctx.params.token ?? '');
  return json(view);
});
