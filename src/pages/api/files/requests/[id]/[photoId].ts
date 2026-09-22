import type { APIRoute } from 'astro';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { requestPhotos } from '@/server/db/schema';
import { notFound, requireSession, route } from '@/server/http';
import { fileResponse, readBlob } from '@/server/uploads';

export const prerender = false;

export const GET: APIRoute = route(async (ctx) => {
  requireSession(ctx);
  const [p] = await db()
    .select()
    .from(requestPhotos)
    .where(
      and(eq(requestPhotos.id, ctx.params.photoId!), eq(requestPhotos.requestId, ctx.params.id!)),
    )
    .limit(1);
  if (!p) throw notFound();
  const blob = await readBlob(p.blobKey);
  if (!blob) throw notFound();
  return fileResponse(blob, 'private');
});
