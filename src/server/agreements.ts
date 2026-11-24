import { eq } from 'drizzle-orm';
import { dutiesFromText, type AccountDocKind, type MergeVars } from '@/config/documents';
import type { AppSession } from './auth/server';
import { db } from './db/client';
import { appUsers } from './db/schema';
import { HttpError } from './http';
import { accountSignRequests, resendSignRequest, sendForSignature, toView } from './esign';
import { agreementStatus, requiredAgreements, type AgreementStatus } from './agreement-rules';

/**
 * Officer and board agreements: sent to an account (sign_requests.user_id),
 * with the person's name, title, and duties merged in. Drafts for now, so a
 * missing signature shows a banner and a to-do but never blocks the portal.
 */
type UserRow = typeof appUsers.$inferSelect;

export function agreementVars(u: UserRow, kind: AccountDocKind): MergeVars {
  const title =
    kind === 'officer-agreement' ? u.title || 'an officer' : u.boardTitle || 'a director';
  return { name: u.name || u.email, title, duties: dutiesFromText(u.duties) };
}

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
  };
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
  const result = { sent: [] as string[], resent: [] as string[], failed: [] as string[] };
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
        const out = await resendSignRequest(st.requestId, by);
        (out.emailed ? result.resent : result.failed).push(who);
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
