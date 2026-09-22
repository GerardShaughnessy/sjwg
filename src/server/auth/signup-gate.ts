import type { APIContext } from 'astro';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { invitations } from '../db/schema';
import { sha256 } from '../refs';
import { json } from '../http';

export const INVITE_HEADER = 'x-invite-token';
/** An invitation must have been opened within this window before sign-up. */
export const INVITE_OPEN_WINDOW_MS = 30 * 60 * 1000;

/**
 * Returns a Response when sign-up must be refused, otherwise null.
 * The body is cloned so the proxy can still forward the original stream.
 */
export async function guardSignUp(ctx: APIContext): Promise<Response | null> {
  const token = ctx.request.headers.get(INVITE_HEADER);
  if (!token) return refuse();
  let email = '';
  try {
    const body = (await ctx.request.clone().json()) as { email?: string };
    email = (body.email ?? '').trim().toLowerCase();
  } catch {
    return refuse();
  }
  const inv = await findOpenInvitation(token);
  if (!inv || inv.email.toLowerCase() !== email) return refuse();
  return null;
}

export async function findOpenInvitation(token: string) {
  const [inv] = await db()
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.tokenHash, sha256(token)),
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!inv) return null;
  if (!inv.openedAt || Date.now() - inv.openedAt.getTime() > INVITE_OPEN_WINDOW_MS) return null;
  return inv;
}

function refuse() {
  return json(
    { error: 'Membership is by invitation. Ask a Guild officer for an invitation link.' },
    403,
  );
}
