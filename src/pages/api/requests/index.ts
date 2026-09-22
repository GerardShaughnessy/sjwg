import type { APIRoute } from 'astro';
import { json, requireSession, route } from '@/server/http';
import { createRequest, readRequestForm } from '@/server/requests';
import { listRequests, type RequestStatus } from '@/server/db/queries/requests';

export const prerender = false;

/** Public: the request-help wizard posts here. Never asks for money. */
export const POST: APIRoute = route(async (ctx) => {
  const { answers, photo } = await readRequestForm(ctx);
  const { row, token, confirmationSent, photoCount } = await createRequest(ctx, answers, photo);
  return json(
    {
      id: row.id,
      ref: row.ref,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      trackingUrl: `/request/track/${token}`,
      confirmationSent,
      photoCount,
    },
    201,
  );
});

/** Members: the job board. */
export const GET: APIRoute = route(async (ctx) => {
  requireSession(ctx);
  const status = (new URL(ctx.request.url).searchParams.get('status') || 'active') as
    RequestStatus | 'active';
  return json({ requests: await listRequests(status) });
});
