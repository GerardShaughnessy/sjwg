import type { APIRoute } from 'astro';
import { db } from '@/server/db/client';
import { directoryAffirmations } from '@/server/db/schema';
import { badRequest, clientIp, json, rateLimit, readJson, route } from '@/server/http';
import { hashIp } from '@/server/refs';
import { parseOrThrow } from '@/server/schemas';
import { affirmSchema } from '@/server/directory';
import { DIRECTORY_TERMS_VERSION } from '@/config/directory-terms';
import { DIR_COOKIE, dirCookieSecret, signDirCookie } from '@/server/directory-cookie';

export const prerender = false;

/**
 * A visitor affirms the directory terms. The row is the record of what he
 * agreed to; the signed cookie opens the directory for a year, or until the
 * terms change.
 */
export const POST: APIRoute = route(async (ctx) => {
  const raw = (await readJson<Record<string, unknown>>(ctx)) ?? {};
  // Honeypot: pretend it worked, set nothing.
  if (typeof raw.website === 'string' && raw.website.trim()) return json({ ok: true }, 201);
  const ip = clientIp(ctx);
  if (!rateLimit(`dir-affirm:${ip ?? 'none'}`, 6, 10 * 60 * 1000))
    throw badRequest('Too many tries in a row. Wait a few minutes and try again.');
  const data = parseOrThrow(affirmSchema, raw);
  const notCatholic = data.catholic === 'not-catholic';
  await db()
    .insert(directoryAffirmations)
    .values({
      fullName: data.fullName,
      email: data.email,
      signedDate: data.signedDate,
      isCatholic: !notCatholic,
      alignmentNote: notCatholic ? data.alignmentNote : '',
      termsVersion: DIRECTORY_TERMS_VERSION,
      ipHash: hashIp(ip),
      userAgent: (ctx.request.headers.get('user-agent') ?? '').slice(0, 300) || null,
    });
  const { value, expires } = signDirCookie(DIRECTORY_TERMS_VERSION, dirCookieSecret());
  const host = ctx.url.hostname;
  ctx.cookies.set(DIR_COOKIE, value, {
    httpOnly: true,
    secure: !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]'),
    sameSite: 'lax',
    path: '/',
    expires,
  });
  return json({ ok: true }, 201);
});
