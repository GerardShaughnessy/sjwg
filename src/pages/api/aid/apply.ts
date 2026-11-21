import type { APIRoute } from 'astro';
import { and, eq, gt, sql } from 'drizzle-orm';
import { checkFormToken, formTokenMessage } from '@/server/spam';
import { db } from '@/server/db/client';
import { aidApplications } from '@/server/db/schema';
import { sendEmail } from '@/server/email/send';
import { aidConfirmation, aidOfficerAlert } from '@/server/email/templates/aid';
import { INBOX, recipientsFor } from '@/config/contact-routing';
import { badRequest, clientIp, json, rateLimit, route } from '@/server/http';
import { hashIp, makeRef, withUniqueRetry } from '@/server/refs';
import { parseOrThrow } from '@/server/schemas';
import { aidApplicationSchema } from '@/server/aid';
import { saveDocument, validateDoc, type ValidDoc } from '@/server/documents';
import { AID_MAX_FILES, pickAnswers } from '@/lib/aid';

export const prerender = false;

/**
 * Public. A Request Help application: multipart/form-data with a `data` JSON
 * field and up to five `files`. Every file is checked before anything is saved.
 */
export const POST: APIRoute = route(async (ctx) => {
  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    throw badRequest('The form did not arrive whole. Try again.');
  }
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(String(form.get('data') ?? '{}')) ?? {};
  } catch {
    throw badRequest('The form did not arrive whole. Try again.');
  }
  // Honeypot: bots fill every field. Pretend it worked and drop it.
  if (typeof raw.website === 'string' && raw.website.trim()) return json({ ref: makeRef() }, 201);

  const ip = clientIp(ctx);
  if (!rateLimit(`aid:${ip ?? 'none'}`, 4, 10 * 60 * 1000))
    throw badRequest('Too many requests in a row. Wait a few minutes and try again.');

  const tok = checkFormToken('aid', raw.formToken);
  if (tok !== 'ok') throw badRequest(formTokenMessage(tok));
  delete raw.formToken;
  const ipHash = hashIp(ip);
  if (ipHash) {
    const [{ n }] = await db()
      .select({ n: sql<number>`count(*)::int` })
      .from(aidApplications)
      .where(
        and(
          eq(aidApplications.ipHash, ipHash),
          gt(aidApplications.createdAt, new Date(Date.now() - 86_400_000)),
        ),
      );
    if (n >= 5)
      throw badRequest(
        'We already have several requests from you today. Email hello@sjwg.org if you need to add something.',
      );
  }

  const data = parseOrThrow(aidApplicationSchema, raw);

  const uploads = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
  if (uploads.length > AID_MAX_FILES)
    throw badRequest(`Send ${AID_MAX_FILES} files at most.`, {
      files: `Send ${AID_MAX_FILES} files at most.`,
    });
  const files: { file: ValidDoc; name: string }[] = [];
  for (const f of uploads) {
    const checked = validateDoc(new Uint8Array(await f.arrayBuffer()));
    if ('error' in checked) {
      const message = `${f.name}: ${checked.error}`;
      throw badRequest(message, { files: message });
    }
    files.push({ file: checked, name: f.name });
  }

  const answers = pickAnswers(data);
  const app = await withUniqueRetry(async () => {
    const [row] = await db()
      .insert(aidApplications)
      .values({
        ref: makeRef(),
        applicantType: data.applicantType,
        contactName: data.contactName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        orgName: data.orgName,
        urgency: data.urgency,
        answers,
        ipHash: hashIp(ip),
      })
      .returning({ id: aidApplications.id, ref: aidApplications.ref });
    return row;
  });

  const saved: { filename: string }[] = [];
  let filesFailed = 0;
  for (const f of files) {
    try {
      const doc = await saveDocument({
        ownerType: 'aid',
        ownerId: app.id,
        kind: 'supporting',
        file: f.file,
        filename: f.name,
      });
      saved.push({ filename: doc.filename });
    } catch (err) {
      filesFailed++;
      console.error(`[aid] could not save a file for ${app.ref}`, err);
    }
  }

  const officer = await sendEmail({
    to: recipientsFor('aid'),
    email: aidOfficerAlert({ id: app.id, ref: app.ref, answers, files: saved, filesFailed }),
    template: 'aid-officer',
    replyTo: data.email,
    related: { type: 'aid', id: app.id },
  });
  if (officer.status === 'sent')
    await db()
      .update(aidApplications)
      .set({ notifiedAt: new Date() })
      .where(eq(aidApplications.id, app.id));

  await sendEmail({
    to: data.email,
    email: aidConfirmation({
      ref: app.ref,
      contactName: data.contactName,
      urgency: data.urgency,
      fileCount: saved.length,
    }),
    template: 'aid-confirmation',
    replyTo: INBOX.hello,
    related: { type: 'aid', id: app.id },
  });

  return json({ ref: app.ref, filesSaved: saved.length, filesFailed }, 201);
});
