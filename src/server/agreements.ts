import { eq } from 'drizzle-orm';
import { isAccountDocKind, type AccountDocKind } from '@/config/documents';
import type { AppSession } from './auth/server';
import { db } from './db/client';
import { appUsers } from './db/schema';
import { HttpError } from './http';
import {
  accountSignRequests,
  getSignRequest,
  resendSignRequest,
  sendForSignature,
  toView,
  voidSignRequest,
} from './esign';
import {
  agreementIsStale,
  agreementNoLongerApplies,
  agreementStatus,
  agreementVars,
  requiredAgreements,
  type AgreementStatus,
} from './agreement-rules';

export { agreementVars };

/**
 * Officer and board agreements: sent to an account (sign_requests.user_id),
 * with the person's name, title, and duties merged in. Drafts for now, so a
 * missing signature shows a banner and a to-do but never blocks the portal.
 */
type UserRow = typeof appUsers.$inferSelect;

async function loadUser(id: string): Promise<UserRow> {
  const [u] = await db().select().from(appUsers).where(eq(appUsers.id, id)).limit(1);
  if (!u) throw new HttpError(404, 'That account was not found.');
  return u;
}

function assertNeeds(u: UserRow, kind: AccountDocKind) {
  if (!requiredAgreements(u).includes(kind))
    throw new HttpError(
      400,
      kind === 'officer-agreement'
        ? 'Only an enabled officer gets the officer agreement.'
        : 'Only an enabled director gets the board agreement.',
    );
}

/** Send one agreement. Refuses when one is already signed or waiting: resend that instead. */
export async function sendAgreement(
  kind: AccountDocKind,
  userId: string,
  by: Pick<AppSession, 'userId' | 'name'>,
) {
  const u = await loadUser(userId);
  assertNeeds(u, kind);
  const now = agreementStatus(await accountSignRequests(u.id), u.id, kind);
  if (now.state === 'signed') throw new HttpError(409, `${u.name || u.email} already signed it.`);
  if (now.state === 'sent')
    throw new HttpError(409, 'It was already sent. Use Resend to email a new link.');
  const out = await sendForSignature({
    docKind: kind,
    userId: u.id,
    vars: agreementVars(u, kind),
    name: u.name || u.email,
    email: u.email,
    sentBy: by,
  });
  return {
    request: toView(out.row),
    emailed: out.emailed,
    mailError: out.mailError,
    link: out.link,
    // A double click: the first click's request, not a second one.
    existing: out.existing,
  };
}

export const STALE_RESENT =
  'Their name, title, or duties changed since it was sent, so the old request was voided and a new one was sent with the current text.';

/**
 * A new link for an open officer or board agreement. When the person's name,
 * title, or duties no longer match the frozen text, the old request is voided
 * and a fresh one goes out with the current text (`replaced`).
 */
export async function resendAgreement(requestId: string, by: Pick<AppSession, 'userId' | 'name'>) {
  const row = await getSignRequest(requestId);
  if (!row) throw new HttpError(404, 'That signature request was not found.');
  if (!isAccountDocKind(row.docKind))
    throw new HttpError(400, 'That is not an officer or board agreement.');
  const kind = row.docKind;
  const u = row.userId && !row.signedAt && !row.voidedAt ? await loadUser(row.userId) : null;
  if (u && agreementIsStale({ docKind: kind, docSha256: row.docSha256 }, u)) {
    assertNeeds(u, kind);
    await voidSignRequest(row.id, by);
    const out = await sendForSignature({
      docKind: kind,
      userId: u.id,
      vars: agreementVars(u, kind),
      name: u.name || u.email,
      email: u.email,
      sentBy: by,
    });
    return {
      row: out.row,
      emailed: out.emailed,
      mailError: out.mailError,
      link: out.link,
      replaced: true,
      message: STALE_RESENT,
    };
  }
  const out = await resendSignRequest(requestId, by);
  return {
    row: out.row,
    emailed: out.emailed,
    mailError: out.mailError,
    link: out.link,
    replaced: false,
    message: null,
  };
}

/**
 * 410 when an open officer or board agreement can no longer be signed: the
 * person is disabled, or no longer an officer (or no longer on the board).
 * Tradesman paperwork passes through untouched.
 */
export async function assertAgreementStillApplies(row: {
  docKind: string;
  userId: string | null;
}): Promise<void> {
  if (!isAccountDocKind(row.docKind)) return;
  const [u] = row.userId
    ? await db().select().from(appUsers).where(eq(appUsers.id, row.userId)).limit(1)
    : [];
  const why = agreementNoLongerApplies(row.docKind, u ?? null);
  if (why) throw new HttpError(410, why);
}

/**
 * Everyone who needs this agreement and has not signed it: a first send for
 * those never sent one, a fresh link for those who have one waiting.
 */
export async function sendAgreementToAll(
  kind: AccountDocKind,
  by: Pick<AppSession, 'userId' | 'name'>,
) {
  const [users, requests] = await Promise.all([
    db().select().from(appUsers).where(eq(appUsers.disabled, false)),
    accountSignRequests(),
  ]);
  const result = {
    sent: [] as string[],
    resent: [] as string[],
    /** Resent as a new request, because their name, title, or duties changed. */
    replaced: [] as string[],
    failed: [] as string[],
  };
  for (const u of users) {
    if (!requiredAgreements(u).includes(kind)) continue;
    const st = agreementStatus(requests, u.id, kind);
    const who = u.name || u.email;
    try {
      if (st.state === 'not_sent') {
        const out = await sendForSignature({
          docKind: kind,
          userId: u.id,
          vars: agreementVars(u, kind),
          name: who,
          email: u.email,
          sentBy: by,
        });
        (out.emailed ? result.sent : result.failed).push(who);
      } else if (st.state === 'sent' && st.requestId) {
        const out = await resendAgreement(st.requestId, by);
        if (!out.emailed) result.failed.push(who);
        else (out.replaced ? result.replaced : result.resent).push(who);
      }
    } catch (err) {
      console.error('[agreements] could not send to', u.id, err);
      result.failed.push(who);
    }
  }
  return result;
}

/** Every required agreement for every enabled account, for the Officers and Board pages. */
export async function allAgreementStatuses(): Promise<AgreementStatus[]> {
  const [users, requests] = await Promise.all([
    db().select().from(appUsers).where(eq(appUsers.disabled, false)),
    accountSignRequests(),
  ]);
  return users.flatMap((u) => requiredAgreements(u).map((k) => agreementStatus(requests, u.id, k)));
}

/** The logged-in person's own required agreements. */
export async function myAgreements(
  s: Pick<AppSession, 'userId' | 'role' | 'siteAdmin' | 'director'>,
): Promise<AgreementStatus[]> {
  const kinds = requiredAgreements({
    id: s.userId,
    role: s.role,
    siteAdmin: s.siteAdmin,
    director: s.director,
  });
  if (kinds.length === 0) return [];
  const requests = await accountSignRequests(s.userId);
  return kinds.map((k) => agreementStatus(requests, s.userId, k));
}
