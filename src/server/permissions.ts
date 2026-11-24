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
  /** On the board of directors. Independent of officer access. */
  director?: boolean;
  boardTitle?: string;
  /** An outside person or business providing services. Independent of officer and board status. */
  vendor?: boolean;
  vendorService?: string;
}

/**
 * Guards for PATCH /api/users/[id], after requireSiteAdmin. The Admin can't
 * lock themself out, so the site always keeps one Admin.
 */
export function assertUserPatchAllowed(
  actor: AppSession,
  target: { id: string; role: Role; disabled?: boolean; director?: boolean; vendor?: boolean },
  patch: UserPatch,
): void {
  assertBoardPatchAllowed(target, patch);
  assertVendorPatchAllowed(target, patch);
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
 * Board rules. A director needs an enabled account but not officer access,
 * and a board title only means something on the board.
 */
export function assertBoardPatchAllowed(
  target: { disabled?: boolean; director?: boolean },
  patch: UserPatch,
): void {
  const disabledAfter = patch.disabled ?? target.disabled ?? false;
  const directorAfter = patch.director ?? target.director ?? false;
  if (patch.director === true && disabledAfter)
    throw badRequest('Enable their account first. Only an enabled account can be on the board.');
  if (patch.boardTitle && !directorAfter)
    throw badRequest('Add them to the board first. Only a director has a board title.');
}

/**
 * Vendor rules, the same shape as the board rules. A vendor needs an enabled
 * account, and a service only means something for a vendor.
 */
export function assertVendorPatchAllowed(
  target: { disabled?: boolean; vendor?: boolean },
  patch: UserPatch,
): void {
  const disabledAfter = patch.disabled ?? target.disabled ?? false;
  const vendorAfter = patch.vendor ?? target.vendor ?? false;
  if (patch.vendor === true && disabledAfter)
    throw badRequest('Enable their account first. Only an enabled account can be a vendor.');
  if (patch.vendorService && !vendorAfter)
    throw badRequest('Add them as a vendor first. Only a vendor has a service.');
}

/**
 * The columns a checked patch writes. Officer access, board membership and
 * vendor status are separate: removing one never touches the others. Leaving
 * the board clears the board title, leaving the vendor list clears the
 * service, and losing officer access drops the Admin flag.
 */
export function userPatchSet(patch: UserPatch) {
  const set: {
    role?: Role;
    title?: string;
    disabled?: boolean;
    siteAdmin?: boolean;
    director?: boolean;
    boardTitle?: string;
    vendor?: boolean;
    vendorService?: string;
  } = {};
  if (patch.role !== undefined) set.role = patch.role;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.disabled !== undefined) set.disabled = patch.disabled;
  if (patch.siteAdmin !== undefined) set.siteAdmin = patch.siteAdmin;
  if (patch.director !== undefined) set.director = patch.director;
  if (patch.boardTitle !== undefined) set.boardTitle = patch.boardTitle;
  if (patch.vendor !== undefined) set.vendor = patch.vendor;
  if (patch.vendorService !== undefined) set.vendorService = patch.vendorService;
  if (patch.role === 'member') set.siteAdmin = false;
  if (patch.director === false) set.boardTitle = '';
  if (patch.vendor === false) set.vendorService = '';
  // A disabled account leaves the board and the vendor list, so neither page hides anyone.
  if (patch.disabled === true) {
    set.director = false;
    set.boardTitle = '';
    set.vendor = false;
    set.vendorService = '';
  }
  return set;
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
