import type { APIRoute } from 'astro';
import { notFound, requireRole, route } from '@/server/http';
import { documentResponse, getDocument } from '@/server/documents';

export const prerender = false;

/** Officers only. One supporting document from an aid application. */
export const GET: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const doc = await getDocument(ctx.params.docId!);
  if (!doc || doc.ownerType !== 'aid' || doc.ownerId !== ctx.params.id)
    throw notFound('That document was not found.');
  const res = await documentResponse(doc);
  if (!res) throw notFound('That file is missing from storage.');
  return res;
});
