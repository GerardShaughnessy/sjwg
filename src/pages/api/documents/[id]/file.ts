import type { APIRoute } from 'astro';
import { HttpError, requireSession, route } from '@/server/http';
import { documentResponse, getDocument } from '@/server/documents';

export const prerender = false;

/** Officers, or the tradesman who owns the file. Aid files are served elsewhere. */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const doc = await getDocument(ctx.params.id!);
  const allowed =
    doc &&
    doc.ownerType === 'member' &&
    (s.role === 'admin' || (Boolean(s.memberId) && doc.ownerId === s.memberId));
  if (!doc || !allowed) throw new HttpError(404, 'That document was not found.');
  const res = await documentResponse(doc);
  if (!res) throw new HttpError(404, 'That file is missing from storage.');
  return res;
});
