import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { appUsers, members } from '../schema';
import { HttpError } from '../../http';
import { dropsAdmin, LAST_ADMIN_MESSAGE, userPatchSet, type UserPatch } from '../../permissions';

export interface UserView {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  title: string;
  disabled: boolean;
  siteAdmin: boolean;
  director: boolean;
  boardTitle: string;
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
    director: u.director,
    boardTitle: u.boardTitle,
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

/**
 * Every active officer, for the Officers page all officers can see. The Admin
 * keeps role 'admin' for access but is not an officer, so is left out.
 */
export async function listOfficers() {
  return (await selectUsers(eq(appUsers.role, 'admin'))).filter(
    (u) => !u.disabled && !u.siteAdmin,
  );
}

/** One director on the Board page. Officers and directors can read it. */
export interface BoardMemberView {
  id: string;
  name: string;
  email: string;
  boardTitle: string;
  /** Also an officer, and their officer title if so. */
  officer: boolean;
  officerTitle: string;
  /** From the linked tradesman entry, if any. */
  phone: string;
  lastLoginAt: string | null;
}

/** Phone and last sign-in are officer-only details; other directors see name, title and email. */
export function toBoardMember(u: UserView, forOfficer = true): BoardMemberView {
  // The Admin keeps officer access under the hood but is not shown as an officer.
  const officer = u.role === 'admin' && !u.siteAdmin;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    boardTitle: u.boardTitle,
    officer,
    officerTitle: officer ? u.title : '',
    phone: forOfficer ? (u.member?.privatePhone ?? '') : '',
    lastLoginAt: forOfficer ? u.lastLoginAt : null,
  };
}

/** Every enabled director, for the Board page. */
export async function listBoard(forOfficer = true): Promise<BoardMemberView[]> {
  return (await selectUsers(eq(appUsers.director, true)))
    .filter((u) => !u.disabled)
    .map((u) => toBoardMember(u, forOfficer));
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
 * Applies a checked patch. Losing officer access also drops the Admin flag
 * but keeps board membership; leaving the board clears the board title.
 * Taking the Admin level from the current Admin only goes through while
 * another enabled Admin exists, so the site never ends up with none.
 */
export async function updateUser(
  target: { id: string; role: 'admin' | 'member'; siteAdmin: boolean; disabled: boolean },
  patch: UserPatch,
) {
  const set: Partial<typeof appUsers.$inferInsert> = userPatchSet(patch);
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
