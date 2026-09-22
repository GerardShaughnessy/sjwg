import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { requestPhotos } from '@/server/db/schema';
import { notFound, route } from '@/server/http';
import { findByToken } from '@/server/track';
import { fileResponse, readBlob } from '@/server/uploads';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  const req = await findByToken(ctx.params.token ?? '');
  const [p] = await db()
    .select()
    .from(requestPhotos)
    .where(and(eq(requestPhotos.id, ctx.params.photoId!), eq(requestPhotos.requestId, req.id)))
    .limit(1);
  if (!p) throw notFound();
  const blob = await readBlob(p.blobKey);
  if (!blob) throw notFound();
  return fileResponse(blob, 'private');
});
