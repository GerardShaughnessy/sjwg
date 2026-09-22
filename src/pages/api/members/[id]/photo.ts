import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { members } from '@/server/db/schema';
import { HttpError, badRequest, json, readJson, requireSession, route } from '@/server/http';
import { getMember, memberView } from '@/server/db/queries/members';
import { parseOrThrow, uploadSchema } from '@/server/schemas';
import { PHOTO_MAX_BYTES, putMemberPhoto, validateImage } from '@/server/uploads';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

/** A member uploads his own portrait; an officer can upload anyone's. JSON { name, dataBase64 }. */
export const POST: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const m = await getMember(ctx.params.id!);
  if (session.role !== 'admin' && session.memberId !== m.id)
    throw new HttpError(403, 'You can only change your own photo.');
  const { dataBase64 } = parseOrThrow(uploadSchema, await readJson(ctx));
  if (dataBase64.length > PHOTO_MAX_BYTES * 1.4)
    throw badRequest('That photo is too big. Keep it under 4 MB.', {
      photo: 'Keep it under 4 MB.',
    });
  const v = validateImage(new Uint8Array(Buffer.from(dataBase64, 'base64')), 'photo');
  if ('error' in v) throw badRequest(v.error, { photo: v.error });
  const key = await putMemberPhoto(m.id, v);
  const [row] = await db()
    .update(members)
    .set({ photoKey: key, updatedAt: new Date() })
    .where(eq(members.id, m.id))
    .returning();
  const rebuild = row.public ? await requestRebuild(`member photo: ${row.name}`) : null;
  return json({ member: memberView(row), rebuild });
});

export const DELETE: APIRoute = route(async (ctx) => {
  const session = requireSession(ctx);
  const m = await getMember(ctx.params.id!);
  if (session.role !== 'admin' && session.memberId !== m.id)
    throw new HttpError(403, 'You can only change your own photo.');
  const [row] = await db()
    .update(members)
    .set({ photoKey: null, updatedAt: new Date() })
    .where(eq(members.id, m.id))
    .returning();
  const rebuild = row.public ? await requestRebuild(`member photo removed: ${row.name}`) : null;
  return json({ member: memberView(row), rebuild });
});
