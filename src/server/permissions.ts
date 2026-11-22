import type { AppSession, Role } from './auth/server';
import { badRequest, HttpError } from './http';

/** Officers invite tradesmen. Only the Admin invites an officer. */
export function assertCanInvite(by: AppSession, role: Role): void {
  if (role === 'admin' && !(by.role === 'admin' && by.siteAdmin))
    throw new HttpError(403, 'Only the Admin can invite an officer. You can invite tradesmen.');
}

export interface UserPatch {
  role?: Role;
  title?: string;
  disabled?: boolean;
  siteAdmin?: boolean;
}

/**
 * Guards for PATCH /api/users/[id], after requireSiteAdmin. The Admin can't
 * lock themself out, so the site always keeps one Admin.
 */
export function assertUserPatchAllowed(
  actor: AppSession,
  target: { id: string; role: Role },
  patch: UserPatch,
): void {
  if (target.id === actor.userId) {
    if (patch.siteAdmin === false)
      throw badRequest("You can't remove your own Admin access. Ask another Admin to do it.");
    if (patch.disabled === true) throw badRequest("You can't disable your own account.");
    if (patch.role === 'member')
      throw badRequest("You can't remove your own officer access while you are the Admin.");
  }
  const roleAfter = patch.role ?? target.role;
  if (patch.siteAdmin === true && roleAfter !== 'admin')
    throw badRequest('Make them an officer first. Only an officer can be the Admin.');
}

/**
 * True when this patch takes the Admin level away from someone who has it now:
 * removing the flag, removing officer access, or disabling the account. Such
 * an update must leave another enabled Admin, checked in the UPDATE itself.
 */
export function dropsAdmin(
  target: { role: Role; siteAdmin: boolean; disabled: boolean },
  patch: UserPatch,
): boolean {
  if (!(target.role === 'admin' && target.siteAdmin && !target.disabled)) return false;
  return patch.siteAdmin === false || patch.role === 'member' || patch.disabled === true;
}

export const LAST_ADMIN_MESSAGE = 'The Guild needs an Admin. Make another officer the Admin first.';
