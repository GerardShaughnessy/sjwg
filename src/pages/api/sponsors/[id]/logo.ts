import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { db } from '@/server/db/client';
import { sponsors } from '@/server/db/schema';
import { badRequest, json, readJson, requireRole, route } from '@/server/http';
import { getSponsor, sponsorView } from '@/server/db/queries/sponsors';
import { parseOrThrow, uploadSchema } from '@/server/schemas';
import { LOGO_MAX_BYTES, putSponsorLogo, validateImage } from '@/server/uploads';
import { requestRebuild } from '@/server/build-hook';

export const prerender = false;

/** JSON upload: { name, dataBase64 }. PNG, JPEG, WebP, or SVG up to 1 MB. */
export const POST: APIRoute = route(async (ctx) => {
  requireRole(ctx, 'admin');
  const s = await getSponsor(ctx.params.id!);
  const { dataBase64 } = parseOrThrow(uploadSchema, await readJson(ctx));
  if (dataBase64.length > LOGO_MAX_BYTES * 1.4)
    throw badRequest('That logo is too big. Keep it under 1 MB.', { logo: 'Keep it under 1 MB.' });
  const v = validateImage(new Uint8Array(Buffer.from(dataBase64, 'base64')), 'logo');
  if ('error' in v) throw badRequest(v.error, { logo: v.error });
  const key = await putSponsorLogo(s.id, v);
  const [row] = await db()
    .update(sponsors)
    .set({ logoKey: key, updatedAt: new Date() })
    .where(eq(sponsors.id, s.id))
    .returning();
  const rebuild = row.active ? await requestRebuild(`sponsor logo: ${row.name}`) : null;
  return json({ sponsor: sponsorView(row), rebuild });
});
