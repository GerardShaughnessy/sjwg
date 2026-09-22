import type { APIRoute } from 'astro';
import { json, readJson, requireSession, route } from '@/server/http';
import { db } from '@/server/db/client';
import { requestEvents, requestNotes } from '@/server/db/schema';
import { getRequest, listEvents, listNotes } from '@/server/db/queries/requests';
import { noteSchema, parseOrThrow } from '@/server/schemas';
import { sendEmail } from '@/server/email/send';
import { requesterNote } from '@/server/email/templates/request';
import { decryptToken } from '@/server/refs';
import { requireEnv } from '@/server/env';

export const prerender = false;

/** Notes and the audit trail for one request. */
export const GET: APIRoute = route(async (ctx) => {
  requireSession(ctx);
  const id = ctx.params.id!;
  await getRequest(id);
  const [notes, events] = await Promise.all([listNotes(id, false), listEvents(id)]);
  return json({ notes, events });
});

export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const id = ctx.params.id!;
  const req = await getRequest(id);
  const { body, visibleToRequester } = parseOrThrow(noteSchema, await readJson(ctx));
  const d = db();
  const [note] = await d
    .insert(requestNotes)
    .values({
      requestId: id,
      authorKind: 'member',
      authorUserId: session.userId,
      authorName: session.name,
      body,
      visibleToRequester,
    })
    .returning();
  await d.insert(requestEvents).values({
    requestId: id,
    actorKind: 'member',
    actorUserId: session.userId,
    actorName: session.name,
    action: 'note_added',
    detail: { visibleToRequester },
  });
  let emailed = false;
  if (visibleToRequester && req.contactEmail) {
    const token = req.trackingTokenEnc
      ? decryptToken(req.trackingTokenEnc, requireEnv('NEON_AUTH_COOKIE_SECRET'))
      : null;
    const res = await sendEmail({
      to: req.contactEmail,
      email: requesterNote({ ref: req.ref }, body, token),
      template: 'requester-note',
      related: { type: 'request', id },
    });
    emailed = res.status === 'sent';
  }
  return json({ note, emailed }, 201);
});
