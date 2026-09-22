import type { APIRoute } from 'astro';
import { requireRole, route } from '@/server/http';
import { donationsCsv, listDonations } from '@/server/db/queries/donations';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const csv = donationsCsv(await listDonations());
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="sjwg-donations-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
});
