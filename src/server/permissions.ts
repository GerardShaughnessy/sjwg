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
