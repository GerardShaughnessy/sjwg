import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, invitations, members } from '../schema';
import { makeToken, sha256 } from '../../refs';
import { sendEmail } from '../../email/send';
import { memberInvitation } from '../../email/templates/account';
import { HttpError } from '../../http';
import type { AppSession } from '../../auth/server';

export const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;

export async function listInvitations() {
  const rows = await db()
    .select({ inv: invitations, invitedByName: appUsers.name, memberName: members.name })
    .from(invitations)
    .leftJoin(appUsers, eq(invitations.invitedBy, appUsers.id))
    .leftJoin(members, eq(invitations.memberId, members.id))
    .orderBy(desc(invitations.createdAt))
    .limit(200);
  return rows.map(({ inv, invitedByName, memberName }) => ({
    id: inv.id,
    email: inv.email,
    name: inv.name,
    role: inv.role,
    memberId: inv.memberId,
    memberName,
    invitedBy: invitedByName,
    expiresAt: inv.expiresAt.toISOString(),
    openedAt: inv.openedAt?.toISOString() ?? null,
    acceptedAt: inv.acceptedAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    state: inv.acceptedAt ? 'accepted' : inv.expiresAt < new Date() ? 'expired' : 'pending',
  }));
}

/** Creates (or refreshes) an invitation and emails the link. Returns the row and whether mail went out. */
export async function invite(
  input: { email: string; name: string; role: 'admin' | 'member'; memberId?: string | null },
  by: AppSession,
) {
  const d = db();
  const email = input.email.toLowerCase();
  const [existingUser] = await d
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(sql`lower(${appUsers.email}) = ${email}`)
    .limit(1);
  if (existingUser)
    throw new HttpError(
      409,
      'That email already has a Guild account. They can log in or reset their password.',
    );
  // One live invitation per email: supersede any pending one.
  await d
    .delete(invitations)
    .where(and(sql`lower(${invitations.email}) = ${email}`, isNull(invitations.acceptedAt)));
  const token = makeToken();
  const [row] = await d
    .insert(invitations)
    .values({
      email,
      name: input.name || null,
      role: input.role,
      memberId: input.memberId ?? null,
      tokenHash: sha256(token),
      invitedBy: by.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning();
  const mail = await sendEmail({
    to: email,
    email: memberInvitation({ name: input.name, invitedBy: by.name, role: input.role, token }),
    template: 'member-invitation',
    related: { type: 'invitation', id: row.id },
  });
  return {
    row,
    token,
    emailed: mail.status === 'sent',
    mailError: mail.status === 'sent' ? null : mail.error,
  };
}

export async function resend(id: string, by: AppSession) {
  const [row] = await db().select().from(invitations).where(eq(invitations.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That invitation was not found.');
  if (row.acceptedAt) throw new HttpError(409, 'That invitation was already accepted.');
  return invite(
    { email: row.email, name: row.name ?? '', role: row.role, memberId: row.memberId },
    by,
  );
}

export async function revoke(id: string) {
  const [row] = await db()
    .delete(invitations)
    .where(and(eq(invitations.id, id), isNull(invitations.acceptedAt)))
    .returning();
  if (!row) throw new HttpError(404, 'That invitation was not found, or it was already accepted.');
}

export async function markOpened(token: string) {
  const d = db();
  const [row] = await d
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, sha256(token)))
    .limit(1);
  if (!row) return { state: 'missing' as const };
  if (row.acceptedAt) return { state: 'accepted' as const, row };
  if (row.expiresAt < new Date()) return { state: 'expired' as const, row };
  await d.update(invitations).set({ openedAt: new Date() }).where(eq(invitations.id, row.id));
  return { state: 'open' as const, row };
}

/** After sign-up: link the fresh Better Auth user to a Guild account. */
export async function complete(
  token: string,
  authUser: { id: string; email: string; name?: string | null },
) {
  const d = db();
  const [row] = await d
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, sha256(token)))
    .limit(1);
  if (!row || row.acceptedAt || row.expiresAt < new Date())
    throw new HttpError(410, 'That invitation link has expired or was already used.');
  if (row.email.toLowerCase() !== authUser.email.toLowerCase())
    throw new HttpError(403, 'This invitation was sent to a different email address.');
  const [user] = await d
    .insert(appUsers)
    .values({
      authUserId: authUser.id,
      email: row.email,
      name: authUser.name ?? row.name,
      role: row.role,
      memberId: row.memberId,
    })
    .onConflictDoUpdate({
      target: appUsers.authUserId,
      set: { role: row.role, memberId: row.memberId, disabled: false },
    })
    .returning();
  await d
    .update(invitations)
    .set({ acceptedAt: new Date(), authUserId: authUser.id })
    .where(eq(invitations.id, row.id));
  return user;
}
