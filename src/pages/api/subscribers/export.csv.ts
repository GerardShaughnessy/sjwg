import type { APIRoute } from 'astro';
import { requireRole, route } from '@/server/http';
import { listSubscribers, subscribersCsv } from '@/server/db/queries/subscribers';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const csv = subscribersCsv(await listSubscribers());
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sjwg-email-list-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
});
