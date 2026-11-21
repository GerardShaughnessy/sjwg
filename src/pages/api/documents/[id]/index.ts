import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { HttpError, json, readJson, requireRole, requireSession, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { documentReviewSchema } from '@/server/esign-schemas';
import { deleteDocument, getDocument } from '@/server/documents';
import { toDocView } from '@/server/member-docs';
import { db } from '@/server/db/client';
import { documents } from '@/server/db/schema';

export const prerender = false;

/** Officers review: status, note, expiry. */
export const PATCH: APIRoute = route(async (ctx) => {
  const by = requireRole(ctx, 'admin');
  const doc = await getDocument(ctx.params.id!);
  if (!doc || doc.ownerType !== 'member') throw new HttpError(404, 'That document was not found.');
  const patch = parseOrThrow(documentReviewSchema, await readJson(ctx));
  const [row] = await db()
    .update(documents)
    .set({
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      ...(patch.expiresOn !== undefined ? { expiresOn: patch.expiresOn } : {}),
      reviewedBy: by.userId,
      reviewedAt: new Date(),
    })
    .where(eq(documents.id, doc.id))
    .returning();
  return json({ document: toDocView(row, by.name) });
});

/** The tradesman may delete his own while it is pending; officers may delete any. */
export const DELETE: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  const doc = await getDocument(ctx.params.id!);
  if (!doc || doc.ownerType !== 'member') throw new HttpError(404, 'That document was not found.');
  const owns = Boolean(s.memberId) && doc.ownerId === s.memberId;
  if (s.role !== 'admin') {
    if (!owns) throw new HttpError(404, 'That document was not found.');
    if (doc.status !== 'pending')
      throw new HttpError(
        409,
        'An officer already reviewed this one. Ask an officer to remove it.',
      );
  }
  await deleteDocument(doc);
  return json({ ok: true });
});
