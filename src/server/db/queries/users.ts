import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, members } from '../schema';
import { HttpError } from '../../http';
import { dropsAdmin, LAST_ADMIN_MESSAGE, type UserPatch } from '../../permissions';

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  title: string;
  disabled: boolean;
  siteAdmin: boolean;
  lastLoginAt: string | null;
  member: { id: string; name: string; trade: string; privatePhone: string } | null;
}

async function selectUsers(where?: ReturnType<typeof eq>) {
  const q = db()
    .select({
      u: appUsers,
      memberName: members.name,
      trade: members.trade,
      privatePhone: members.privatePhone,
    })
    .from(appUsers)
    .leftJoin(members, eq(members.id, appUsers.memberId));
  const rows = await (where ? q.where(where) : q).orderBy(asc(appUsers.name), asc(appUsers.email));
  return rows.map(({ u, memberName, trade, privatePhone }): UserView => ({
    id: u.id,
    name: u.name || u.email,
    email: u.email,
    role: u.role,
    title: u.title,
    disabled: u.disabled,
    siteAdmin: u.role === 'admin' && u.siteAdmin,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    member: u.memberId
      ? {
          id: u.memberId,
          name: memberName ?? '',
          trade: trade ?? '',
          privatePhone: privatePhone ?? '',
        }
      : null,
  }));
}

/** Every account on the site. Admin only. */
export const listUsers = () => selectUsers();

/** Every active officer, for the Officers page all officers can see. */
export async function listOfficers() {
  return (await selectUsers(eq(appUsers.role, 'admin'))).filter((u) => !u.disabled);
}

export async function getUser(id: string) {
  const [row] = await db().select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That account was not found.');
  return row;
}

/** Another enabled Admin, besides `id`. Used inside the UPDATE so two Admins can't remove each other at once. */
export function anotherAdminExists(id: string) {
  return sql`exists (select 1 from ${appUsers} as other where other.id <> ${id} and other.role = 'admin' and other.site_admin = true and other.disabled = false)`;
}

/**
 * Applies a checked patch. Losing officer access also drops the Admin flag.
 * Taking the Admin level from the current Admin only goes through while
 * another enabled Admin exists, so the site never ends up with none.
 */
export async function updateUser(
  target: { id: string; role: 'admin' | 'member'; siteAdmin: boolean; disabled: boolean },
  patch: UserPatch,
) {
  const set: Partial<typeof appUsers.$inferInsert> = {};
  if (patch.role !== undefined) set.role = patch.role;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.disabled !== undefined) set.disabled = patch.disabled;
  if (patch.siteAdmin !== undefined) set.siteAdmin = patch.siteAdmin;
  if (patch.role === 'member') set.siteAdmin = false;
  const guard = dropsAdmin(target, patch);
  const [row] = await db()
    .update(appUsers)
    .set(set)
    .where(
      guard
        ? and(eq(appUsers.id, target.id), anotherAdminExists(target.id))
        : eq(appUsers.id, target.id),
    )
    .returning();
  if (!row)
    throw guard
      ? new HttpError(409, LAST_ADMIN_MESSAGE)
      : new HttpError(404, 'That account was not found.');
  return (await selectUsers(eq(appUsers.id, row.id)))[0];
}
