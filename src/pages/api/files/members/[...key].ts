import type { APIRoute } from 'astro';
import { notFound, route } from '@/server/http';
import { fileResponse, readBlob } from '@/server/uploads';

export const prerender = false;

/** Member portraits (a later round uploads them). Public, immutable by key. */
export const GET: APIRoute = route(async (ctx) => {
  const key = ctx.params.key ?? '';
  if (!/^[A-Za-z0-9._\/-]+$/.test(key) || key.includes('..')) throw notFound();
  const blob = await readBlob(`members/${key}`);
  if (!blob) throw notFound();
  return fileResponse(blob, 'immutable');
});
