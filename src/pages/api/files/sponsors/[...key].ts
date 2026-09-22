import type { APIRoute } from 'astro';
import { notFound, route } from '@/server/http';
import { fileResponse, readBlob } from '@/server/uploads';

export const prerender = false;

/** Public, immutable: the key carries a content hash. */
export const GET: APIRoute = route(async (ctx) => {
  const key = ctx.params.key ?? '';
  if (!/^[A-Za-z0-9._\/-]+$/.test(key) || key.includes('..')) throw notFound();
  const blob = await readBlob(`sponsors/${key}`);
  if (!blob) throw notFound();
  return fileResponse(blob, 'immutable');
});
