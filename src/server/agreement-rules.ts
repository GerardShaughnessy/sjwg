/**
 * Pure rules for officer and board agreements: who needs which one, where a
 * person stands, and who may sign a request from the portal. No database.
 */
import {
  composeForSigning,
  dutiesFromText,
  isAccountDocKind,
  type AccountDocKind,
  type MergeVars,
} from '@/config/documents';
import { docSha256 } from './esign-core';
import { HttpError } from './http';

export interface AccountLike {
  id: string;
  role: 'admin' | 'member';
  siteAdmin: boolean;
  director: boolean;
  disabled?: boolean;
}

/**
 * Officers need the officer agreement and directors the board agreement. The
 * Admin is not presented as an officer, so needs only the board agreement if
 * on the board.
 */
export function requiredAgreements(u: AccountLike): AccountDocKind[] {
  if (u.disabled) return [];
  const out: AccountDocKind[] = [];
  if (u.role === 'admin' && !u.siteAdmin) out.push('officer-agreement');
  if (u.director) out.push('board-agreement');
  return out;
}

export type AgreementState = 'not_sent' | 'sent' | 'signed';

export interface AgreementRequestLike {
  id: string;
  docKind: string;
  userId: string | null;
  status: string;
  sentAt: string;
  signedAt: string | null;
  voidedAt: string | null;
  hasPdf: boolean;
}

export interface AgreementStatus {
  kind: AccountDocKind;
  userId: string;
  state: AgreementState;
  requestId: string | null;
  sentAt: string | null;
  signedAt: string | null;
  hasPdf: boolean;
}

/**
 * Where one person stands on one agreement. A signed copy wins; otherwise the
 * newest open request; voided requests do not count.
 */
export function agreementStatus(
  requests: AgreementRequestLike[],
  userId: string,
  kind: AccountDocKind,
): AgreementStatus {
  const mine = requests
    .filter(
      (r) => r.userId === userId && r.docKind === kind && !r.voidedAt && r.status !== 'voided',
    )
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  const signed = mine.find((r) => r.signedAt);
  const pick = signed ?? mine[0];
  if (!pick)
    return {
      kind,
      userId,
      state: 'not_sent',
      requestId: null,
      sentAt: null,
      signedAt: null,
      hasPdf: false,
    };
  return {
    kind,
    userId,
    state: pick.signedAt ? 'signed' : 'sent',
    requestId: pick.id,
    sentAt: pick.sentAt,
    signedAt: pick.signedAt,
    hasPdf: pick.hasPdf,
  };
}

/**
 * Who may open and sign a request from the portal: the tradesman it was
 * addressed to (by directory entry), or the account it was sent to.
 */
export function canSignInPortal(
  s: { userId: string; memberId: string | null },
  row: { memberId: string | null; userId: string | null },
): boolean {
  if (row.userId && row.userId === s.userId) return true;
  return Boolean(s.memberId && row.memberId && row.memberId === s.memberId);
}

/** 403 for anyone else's paperwork. */
export function assertCanSignInPortal(
  s: { userId: string; memberId: string | null },
  row: { memberId: string | null; userId: string | null },
): void {
  if (!canSignInPortal(s, row))
    throw new HttpError(403, 'This paperwork was sent to someone else.');
}

export const AGREEMENT_NOUN: Record<AccountDocKind, string> = {
  'officer-agreement': 'officer agreement',
  'board-agreement': 'board agreement',
};

/** The account fields merged into an agreement. */
export interface AgreementPerson {
  name: string | null;
  email: string;
  title: string | null;
  boardTitle: string | null;
  duties: string;
}

export function agreementVars(u: AgreementPerson, kind: AccountDocKind): MergeVars {
  const title =
    kind === 'officer-agreement' ? u.title || 'an officer' : u.boardTitle || 'a director';
  return { name: u.name || u.email, title, duties: dutiesFromText(u.duties) };
}

/**
 * True when the person's name, title, or duties (or the agreement's text) no
 * longer match what was frozen into an open request, so a resend must void it
 * and send the current text instead.
 */
export function agreementIsStale(
  row: { docKind: AccountDocKind; docSha256: string },
  u: AgreementPerson,
): boolean {
  const now = composeForSigning(row.docKind, agreementVars(u, row.docKind));
  return docSha256(now.html) !== row.docSha256;
}

/**
 * Whether an open agreement can still be signed: the person must still hold
 * the role it is for (officer or director) and not be disabled. Null when
 * it may be signed; otherwise the reason, for a 410.
 */
export function agreementNoLongerApplies(
  kind: AccountDocKind,
  u: (AccountLike & { disabled: boolean }) | null,
): string | null {
  if (!u || u.disabled)
    return 'This agreement is no longer open: the account it was sent to is not active. If you think this is a mistake, contact the Guild.';
  if (!requiredAgreements(u).includes(kind))
    return kind === 'officer-agreement'
      ? 'This agreement is no longer open, since you are no longer listed as an officer. If you think this is a mistake, contact the Guild.'
      : 'This agreement is no longer open, since you are no longer listed on the board. If you think this is a mistake, contact the Guild.';
  return null;
}

/**
 * Who may see a signature request (its row and signed PDF). Officer and board
 * agreements: the Admin and the person it was sent to, nobody else, even if
 * the account was since deleted. Tradesman paperwork: every officer, and the
 * tradesman it was addressed to.
 */
export function canSeeSignRequest(
  s: { userId: string; role: 'admin' | 'member'; siteAdmin: boolean; memberId: string | null },
  row: { docKind: string; userId: string | null; memberId: string | null },
): boolean {
  if (isAccountDocKind(row.docKind)) return s.siteAdmin || row.userId === s.userId;
  return s.role === 'admin' || Boolean(s.memberId && row.memberId === s.memberId);
}
