import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { requestEvents, requestNotes, requestPhotos, requests } from './db/schema';
import { listNotes } from './db/queries/requests';
import { sendEmail } from './email/send';
import { memberNoteAlert } from './email/templates/request';
import { env } from './env';
import { HttpError } from './http';
import { sha256 } from './refs';

/** Unknown tokens are a 404, the same as a missing page. Nothing to enumerate. */
export async function findByToken(token: string) {
  if (!token || token.length < 20) throw new HttpError(404, 'That link is not right.');
  const [row] = await db()
    .select()
    .from(requests)
    .where(eq(requests.trackingTokenHash, sha256(token)))
    .limit(1);
  if (!row)
    throw new HttpError(404, 'That link is not right, or the request it pointed to is gone.');
  return row;
}

/** What the requester may see. Contact details stay off the page beyond a first name. */
export async function loadTracked(token: string) {
  const r = await findByToken(token);
  const [notes, photos] = await Promise.all([
    listNotes(r.id, true),
    db().select().from(requestPhotos).where(eq(requestPhotos.requestId, r.id)),
  ]);
  return {
    ref: r.ref,
    status: r.status,
    trade: r.trade,
    description: r.description,
    urgency: r.urgency,
    zip: r.zip,
    neighborhood: r.neighborhood,
    firstName: r.contactName.split(/\s+/)[0] ?? '',
    createdAt: r.createdAt.toISOString(),
    claimedAt: r.claimedAt?.toISOString() ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    notes: notes.map((n) => ({
      id: n.id,
      by: n.authorKind === 'member' ? 'Guild' : 'You',
      body: n.body,
      at: n.createdAt.toISOString(),
    })),
    photos: photos.map((p) => ({ id: p.id, url: `/api/files/track/${token}/${p.id}` })),
  };
}

export async function addRequesterNote(req: typeof requests.$inferSelect, body: string) {
  const d = db();
  const [note] = await d
    .insert(requestNotes)
    .values({
      requestId: req.id,
      authorKind: 'requester',
      authorName: req.contactName,
      body,
      visibleToRequester: true,
    })
    .returning();
  await d.insert(requestEvents).values({
    requestId: req.id,
    actorKind: 'requester',
    actorName: req.contactName,
    action: 'note_added',
  });
  const to = env('GUILD_INTAKE_EMAIL');
  if (to) {
    await sendEmail({
      to,
      email: memberNoteAlert({ ref: req.ref, contactName: req.contactName }, body, req.id),
      template: 'member-note-alert',
      replyTo: req.contactEmail || undefined,
      related: { type: 'request', id: req.id },
    });
  }
  return { id: note.id, by: 'You', body: note.body, at: note.createdAt.toISOString() };
}
