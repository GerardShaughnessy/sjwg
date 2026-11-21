import type { APIRoute } from 'astro';
import { HttpError, badRequest, json, rateLimit, requireSession, route } from '@/server/http';
import { parseOrThrow } from '@/server/schemas';
import { documentUploadSchema } from '@/server/esign-schemas';
import { saveDocument, validateDoc } from '@/server/documents';
import { listMemberDocs, memberBriefs, memberExists, toDocView } from '@/server/member-docs';
import { pledgeSignedMemberIds } from '@/server/esign';

export const prerender = false;

/** Officers: every tradesman's documents (or ?memberId). Members: their own. */
export const GET: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  if (s.role === 'admin') {
    const memberId = ctx.url.searchParams.get('memberId') || undefined;
    const [docs, people, pledged] = await Promise.all([
      listMemberDocs(memberId),
      memberBriefs(),
      pledgeSignedMemberIds(),
    ]);
    return json({
      documents: docs,
      members: people.map(({ id, name, trade }) => ({ id, name, trade })),
      pledgeSigned: pledged,
    });
  }
  if (!s.memberId) return json({ documents: [], hasMember: false });
  return json({ documents: await listMemberDocs(s.memberId), hasMember: true });
});

/** Multipart: file, kind, expiresOn, and (officers only) memberId. */
export const POST: APIRoute = route(async (ctx) => {
  const s = requireSession(ctx);
  if (!rateLimit(`docs:${s.userId}`, 20, 60 * 60 * 1000))
    throw new HttpError(429, 'That is a lot of uploads. Wait a while and try again.');
  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    throw badRequest('Send the file as a form upload.');
  }
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === 'string' && v !== '' ? v : undefined;
  };
  const meta = parseOrThrow(documentUploadSchema, {
    kind: field('kind'),
    expiresOn: field('expiresOn'),
    memberId: field('memberId'),
  });

  let ownerId: string | null;
  if (s.role === 'admin' && meta.memberId) {
    if (!(await memberExists(meta.memberId)))
      throw new HttpError(404, 'That tradesman was not found.');
    ownerId = meta.memberId;
  } else {
    ownerId = s.memberId;
  }
  if (!ownerId)
    throw new HttpError(
      403,
      'Your login is not linked to a directory entry yet. Ask a Guild officer to link it.',
    );

  const file = form.get('file');
  if (!(file instanceof File))
    throw badRequest('Choose a file to upload.', { file: 'Choose a file to upload.' });
  const checked = validateDoc(new Uint8Array(await file.arrayBuffer()));
  if ('error' in checked) throw badRequest(checked.error, { file: checked.error });

  const row = await saveDocument({
    ownerType: 'member',
    ownerId,
    kind: meta.kind,
    file: checked,
    filename: file.name,
    uploadedBy: s.userId,
    expiresOn: meta.expiresOn || null,
  });
  return json({ document: toDocView(row) }, 201);
});
