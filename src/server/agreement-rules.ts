/**
 * Pure rules for officer and board agreements: who needs which one, where a
 * person stands, and who may sign a request from the portal. No database.
 */
import type { AccountDocKind } from '@/config/documents';
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
