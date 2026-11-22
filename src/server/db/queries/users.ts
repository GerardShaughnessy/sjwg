import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, members } from '../schema';
import { HttpError } from '../../http';
import type { UserPatch } from '../../permissions';

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

/** Applies a checked patch. Losing officer access also drops the Admin flag. */
export async function updateUser(id: string, patch: UserPatch) {
  const set: Partial<typeof appUsers.$inferInsert> = {};
  if (patch.role !== undefined) set.role = patch.role;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.disabled !== undefined) set.disabled = patch.disabled;
  if (patch.siteAdmin !== undefined) set.siteAdmin = patch.siteAdmin;
  if (patch.role === 'member') set.siteAdmin = false;
  const [row] = await db().update(appUsers).set(set).where(eq(appUsers.id, id)).returning();
  if (!row) throw new HttpError(404, 'That account was not found.');
  return (await selectUsers(eq(appUsers.id, row.id)))[0];
}
