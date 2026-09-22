import type { APIContext } from 'astro';
import { db } from './db/client';
import { requestEvents, requestPhotos, requests } from './db/schema';
import { sendEmail } from './email/send';
import { intakeAlert, requestConfirmation, type RequestSummary } from './email/templates/request';
import { env, requireEnv } from './env';
import { badRequest, clientIp, rateLimit } from './http';
import { encryptToken, hashIp, makeRef, makeToken, sha256, withUniqueRetry } from './refs';
import { parseOrThrow, requestAnswersSchema, type RequestAnswers } from './schemas';
import { PHOTO_MAX_BYTES, putRequestPhoto, validateImage } from './uploads';
import { slugify } from '@/lib/trades';
import { eq } from 'drizzle-orm';

export interface IncomingPhoto {
  name: string;
  bytes: Uint8Array;
}

/**
 * Parse the JSON body the wizard posts: { answers, photo? }. The photo travels
 * as base64 because Netlify function bodies are capped at 6 MB and the browser
 * downsizes the image before sending, so JSON is simplest and reliable.
 */
export async function readRequestForm(
  ctx: APIContext,
): Promise<{ answers: RequestAnswers; photo: IncomingPhoto | null }> {
  let raw: { answers?: unknown; photo?: { name?: string; dataBase64?: string } | null };
  try {
    raw = await ctx.request.json();
  } catch {
    throw badRequest('The request body was not readable. Reload and try again.');
  }
  let photo: IncomingPhoto | null = null;
  if (raw.photo && typeof raw.photo.dataBase64 === 'string' && raw.photo.dataBase64.length > 0) {
    if (raw.photo.dataBase64.length > PHOTO_MAX_BYTES * 1.4)
      throw badRequest('That photo is too big. Keep it under 4 MB.', {
        photo: 'That photo is too big. Keep it under 4 MB.',
      });
    photo = {
      name: String(raw.photo.name ?? 'photo').slice(0, 200),
      bytes: new Uint8Array(Buffer.from(raw.photo.dataBase64, 'base64')),
    };
  }
  return { answers: parseOrThrow(requestAnswersSchema, raw.answers), photo };
}

export async function createRequest(
  ctx: APIContext,
  answers: RequestAnswers,
  photo: IncomingPhoto | null,
) {
  const ip = clientIp(ctx);
  if (!rateLimit(`req:${ip ?? 'none'}`, 5, 10 * 60 * 1000)) {
    throw badRequest(
      'That is a lot of requests from one place in a short time. Wait a few minutes and try once more.',
    );
  }
  let validated: ReturnType<typeof validateImage> | null = null;
  if (photo) {
    validated = validateImage(photo.bytes, 'photo');
    if ('error' in validated) throw badRequest(validated.error, { photo: validated.error });
  }

  const token = makeToken();
  const d = db();
  const row = await withUniqueRetry(async () => {
    const [r] = await d
      .insert(requests)
      .values({
        ref: makeRef(),
        trade: answers.trade,
        tradeSlug: answers.tradeSlug || slugify(answers.trade),
        description: answers.description,
        urgency: answers.urgency,
        zip: answers.zip,
        neighborhood: answers.neighborhood,
        contactName: answers.contact.name,
        contactPhone: answers.contact.phone,
        contactEmail: answers.contact.email,
        bestTime: answers.contact.bestTime,
        trackingTokenHash: sha256(token),
        trackingTokenEnc: encryptToken(token, requireEnv('NEON_AUTH_COOKIE_SECRET')),
        source: 'web',
        ipHash: hashIp(ip),
      })
      .returning();
    return r;
  });

  let photoCount = 0;
  if (validated && 'bytes' in validated) {
    const key = await putRequestPhoto(row.id, validated, photo?.name);
    await d.insert(requestPhotos).values({
      requestId: row.id,
      blobKey: key,
      contentType: validated.contentType,
      sizeBytes: validated.bytes.byteLength,
      originalName: photo?.name ?? null,
    });
    photoCount = 1;
  }
  await d.insert(requestEvents).values({
    requestId: row.id,
    actorKind: 'requester',
    actorName: answers.contact.name,
    action: 'created',
    toStatus: 'open',
    detail: { photoCount },
  });

  const summary: RequestSummary = {
    ref: row.ref,
    trade: row.trade,
    description: row.description,
    urgency: row.urgency,
    zip: row.zip,
    neighborhood: row.neighborhood,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    bestTime: row.bestTime,
    photoCount,
  };

  // Email is best effort. The request is already saved.
  let confirmationSent = false;
  if (row.contactEmail) {
    const res = await sendEmail({
      to: row.contactEmail,
      email: requestConfirmation(summary, token),
      template: 'request-confirmation',
      related: { type: 'request', id: row.id },
    });
    confirmationSent = res.status === 'sent';
    if (confirmationSent)
      await d
        .update(requests)
        .set({ confirmationSentAt: new Date() })
        .where(eq(requests.id, row.id));
  }
  const intakeTo = env('GUILD_INTAKE_EMAIL');
  if (intakeTo) {
    const res = await sendEmail({
      to: intakeTo,
      email: intakeAlert(summary, row.id),
      template: 'intake-alert',
      replyTo: row.contactEmail || undefined,
      related: { type: 'request', id: row.id },
    });
    if (res.status === 'sent')
      await d.update(requests).set({ intakeNotifiedAt: new Date() }).where(eq(requests.id, row.id));
  }

  return { row, token, confirmationSent, photoCount };
}
