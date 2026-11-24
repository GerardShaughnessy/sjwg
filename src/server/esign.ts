import { and, desc, eq, inArray, isNotNull, isNull, gt, ne } from 'drizzle-orm';
import { db } from './db/client';
import { members, signEvents, signRequests } from './db/schema';
import {
  composeForSigning,
  docKindLabel,
  PACKET_KIND,
  type MergeVars,
  type SignDocKind,
} from '@/config/documents';
import type { AppSession } from './auth/server';
import { siteUrl } from './env';
import { HttpError } from './http';
import { sendEmail } from './email/send';
import { signRequestEmail, signedCopyEmail } from './email/templates/esign';
import { readBlob, uploadStore } from './uploads';
import {
  ESIGN_CONSENT_SHA256,
  GUILD_COPY_EMAIL,
  SIGN_TIME_ZONE,
  docSha256,
  guildTime,
  hashSignToken,
  isExpired,
  linkState,
  newSignToken,
} from './esign-core';
import { buildSignedPdf } from './esign-pdf';
import type { SignInput } from './esign-schemas';

/**
 * E-signature by emailed link. The document HTML is frozen and hashed when
 * sent. Only the sha256 of the link token is stored. The signer consents to
 * electronic records, types a name, and gets a signed PDF by email. The
 * officer who sends a request signs for the Guild by sending it.
 */
export type SignRow = typeof signRequests.$inferSelect;

export interface SignRequestView {
  id: string;
  docKind: string;
  docLabel: string;
  title: string;
  signerName: string;
  signerEmail: string;
  memberId: string | null;
  userId: string | null;
  status: string;
  sentByName: string;
  sentAt: string;
  viewedAt: string | null;
  signedAt: string | null;
  signedName: string | null;
  voidedAt: string | null;
  expiresAt: string;
  expired: boolean;
  hasPdf: boolean;
}

/**
 * Only the columns a list view needs: never the frozen document HTML, which
 * is large and only read when someone opens or signs a request.
 */
const VIEW_COLUMNS = {
  id: signRequests.id,
  docKind: signRequests.docKind,
  title: signRequests.title,
  signerName: signRequests.signerName,
  signerEmail: signRequests.signerEmail,
  memberId: signRequests.memberId,
  userId: signRequests.userId,
  status: signRequests.status,
  sentByName: signRequests.sentByName,
  sentAt: signRequests.sentAt,
  viewedAt: signRequests.viewedAt,
  signedAt: signRequests.signedAt,
  signedName: signRequests.signedName,
  voidedAt: signRequests.voidedAt,
  tokenExpiresAt: signRequests.tokenExpiresAt,
  signedPdfKey: signRequests.signedPdfKey,
};
type ViewRow = Pick<SignRow, keyof typeof VIEW_COLUMNS>;

export function toView(r: ViewRow): SignRequestView {
  return {
    id: r.id,
    docKind: r.docKind,
    docLabel: docKindLabel(r.docKind),
    title: r.title,
    signerName: r.signerName,
    signerEmail: r.signerEmail,
    memberId: r.memberId,
    userId: r.userId,
    status: r.status,
    sentByName: r.sentByName,
    sentAt: r.sentAt.toISOString(),
    viewedAt: r.viewedAt?.toISOString() ?? null,
    signedAt: r.signedAt?.toISOString() ?? null,
    signedName: r.signedName,
    voidedAt: r.voidedAt?.toISOString() ?? null,
    expiresAt: r.tokenExpiresAt.toISOString(),
    expired: !r.signedAt && !r.voidedAt && isExpired(r.tokenExpiresAt),
    hasPdf: Boolean(r.signedPdfKey),
  };
}

export const isDraftHtml = (html: string) => html.includes('data-draft="true"');
export const signLink = (token: string) => `${siteUrl()}/sign/${token}`;

type EventCtx = {
  actor?: string;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
  at?: Date;
};

export async function addEvent(requestId: string, type: string, ctx: EventCtx = {}) {
  await db()
    .insert(signEvents)
    .values({
      signRequestId: requestId,
      type,
      actor: ctx.actor ?? '',
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      meta: ctx.meta ?? {},
      ...(ctx.at ? { at: ctx.at } : {}),
    });
}

const expiresLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: SIGN_TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(d);

async function emailLink(row: SignRow, token: string, by: string) {
  const link = signLink(token);
  const mail = await sendEmail({
    to: row.signerEmail,
    email: signRequestEmail({
      signerName: row.signerName,
      title: row.title,
      sentBy: by,
      link,
      expiresOn: expiresLabel(row.tokenExpiresAt),
      draft: isDraftHtml(row.frozenHtml),
    }),
    template: 'sign-request',
    related: { type: 'sign_request', id: row.id },
  });
  const ok = mail.status === 'sent';
  await addEvent(row.id, 'emailed', {
    actor: 'system',
    meta: { ok, to: row.signerEmail, ...(ok ? {} : { error: mail.error }) },
  });
  return { link, emailed: ok, mailError: ok ? null : mail.error };
}

/** Freeze, hash, store, and email. The raw link is returned once so an officer can copy it. */
export async function sendForSignature(input: {
  docKind: SignDocKind;
  memberId?: string | null;
  /** An account's own agreement: who it is for, and what is merged into it. */
  userId?: string | null;
  vars?: MergeVars;
  name?: string;
  email?: string;
  sentBy: Pick<AppSession, 'userId' | 'name'>;
}) {
  let name = input.name?.trim() ?? '';
  let email = input.email?.trim().toLowerCase() ?? '';
  if (input.memberId) {
    const [m] = await db().select().from(members).where(eq(members.id, input.memberId)).limit(1);
    if (!m) throw new HttpError(404, 'That tradesman was not found.');
    name ||= m.name;
    email ||= (m.privateEmail ?? '').toLowerCase();
  }
  if (!name) throw new HttpError(400, 'Who is signing?', { name: 'Who is signing?' });
  if (!email)
    throw new HttpError(400, 'An email address is needed.', {
      email: 'An email address is needed.',
    });

  const frozen = composeForSigning(input.docKind, input.vars);
  const { token, tokenHash, expiresAt } = newSignToken();
  const [row] = await db()
    .insert(signRequests)
    .values({
      docKind: input.docKind,
      title: frozen.title,
      frozenHtml: frozen.html,
      docSha256: docSha256(frozen.html),
      signerName: name,
      signerEmail: email,
      memberId: input.memberId ?? null,
      userId: input.userId ?? null,
      tokenHash,
      tokenExpiresAt: expiresAt,
      status: 'sent',
      sentBy: input.sentBy.userId,
      sentByName: input.sentBy.name,
    })
    .returning();
  await addEvent(row.id, 'sent', {
    actor: input.sentBy.name,
    meta: { docKind: input.docKind, docSha256: row.docSha256, draft: frozen.draft },
  });
  const mail = await emailLink(row, token, input.sentBy.name);
  return { row, token, ...mail };
}

async function getRow(id: string): Promise<SignRow> {
  const [row] = await db().select().from(signRequests).where(eq(signRequests.id, id)).limit(1);
  if (!row) throw new HttpError(404, 'That signature request was not found.');
  return row;
}

/** A new link for the same frozen document. The old link stops working. */
export async function resendSignRequest(id: string, by: Pick<AppSession, 'name'>) {
  const row = await getRow(id);
  if (row.signedAt) throw new HttpError(409, 'That was already signed.');
  if (row.voidedAt) throw new HttpError(409, 'That request was voided. Send a new one.');
  const { token, tokenHash, expiresAt } = newSignToken();
  const [updated] = await db()
    .update(signRequests)
    .set({ tokenHash, tokenExpiresAt: expiresAt })
    .where(
      and(eq(signRequests.id, id), isNull(signRequests.signedAt), isNull(signRequests.voidedAt)),
    )
    .returning();
  if (!updated) throw new HttpError(409, 'That request changed. Reload and try again.');
  await addEvent(id, 'resent', { actor: by.name });
  const mail = await emailLink(updated, token, by.name);
  return { row: updated, token, ...mail };
}

export async function voidSignRequest(id: string, by: Pick<AppSession, 'name'>) {
  const [row] = await db()
    .update(signRequests)
    .set({ status: 'voided', voidedAt: new Date() })
    .where(
      and(eq(signRequests.id, id), isNull(signRequests.signedAt), isNull(signRequests.voidedAt)),
    )
    .returning();
  if (!row) throw new HttpError(409, 'Only an unsigned, open request can be voided.');
  await addEvent(id, 'voided', { actor: by.name });
  return row;
}

export async function listSignRequests(filter: { memberId?: string } = {}) {
  const rows = await db()
    .select(VIEW_COLUMNS)
    .from(signRequests)
    .where(filter.memberId ? eq(signRequests.memberId, filter.memberId) : undefined)
    .orderBy(desc(signRequests.sentAt))
    .limit(300);
  return rows.map(toView);
}

export async function getSignRequest(id: string): Promise<SignRow | null> {
  const [row] = await db().select().from(signRequests).where(eq(signRequests.id, id)).limit(1);
  return row ?? null;
}

export async function findByToken(token: string): Promise<SignRow | null> {
  const hash = hashSignToken(token);
  if (!hash) return null;
  const [row] = await db()
    .select()
    .from(signRequests)
    .where(eq(signRequests.tokenHash, hash))
    .limit(1);
  return row ?? null;
}

/** The first view moves a request from sent to viewed. Later views are not recorded. */
export async function recordView(row: SignRow, ctx: EventCtx): Promise<SignRow> {
  if (row.viewedAt || row.signedAt || row.voidedAt) return row;
  const now = new Date();
  const [updated] = await db()
    .update(signRequests)
    .set({ viewedAt: now, status: 'viewed' })
    .where(
      and(
        eq(signRequests.id, row.id),
        isNull(signRequests.viewedAt),
        eq(signRequests.status, 'sent'),
      ),
    )
    .returning();
  if (!updated) return row;
  await addEvent(row.id, 'viewed', { ...ctx, at: now });
  return updated;
}

export function signedPdfKey(id: string) {
  return `signed/${id}.pdf`;
}

/**
 * Record a signature. `via` says how the signer reached the page: the emailed
 * link (token must still be live) or a logged-in member opening his own request.
 * The signature is the conditional update; the PDF and emails follow it and a
 * failure there never undoes it.
 */
export async function completeSignature(
  row: SignRow,
  input: SignInput,
  ctx: { ip: string | null; userAgent: string | null; via: 'link' | 'portal'; actor: string },
) {
  if (input.docSha256 !== row.docSha256)
    throw new HttpError(
      409,
      'This document changed since you opened it. Reload the page to see the current text.',
    );
  if (input.consentSha256 !== ESIGN_CONSENT_SHA256)
    throw new HttpError(
      409,
      'The consent wording changed since you opened the page. Reload and try again.',
    );
  const gate = linkState(row);
  if (gate === 'signed') throw new HttpError(409, 'This was already signed.');
  if (gate === 'voided') throw new HttpError(410, 'This request was withdrawn by the Guild.');
  if (ctx.via === 'link' && gate === 'expired')
    throw new HttpError(410, 'This link has expired. Ask the Guild to send a new one.');
  if (row.status !== 'sent' && row.status !== 'viewed')
    throw new HttpError(409, 'This request is not open for signing.');

  const now = new Date();
  const conditions = [
    eq(signRequests.id, row.id),
    isNull(signRequests.signedAt),
    isNull(signRequests.voidedAt),
    inArray(signRequests.status, ['sent', 'viewed']),
    eq(signRequests.docSha256, input.docSha256),
  ];
  if (ctx.via === 'link') {
    conditions.push(
      eq(signRequests.tokenHash, row.tokenHash),
      gt(signRequests.tokenExpiresAt, now),
    );
  }
  const [signed] = await db()
    .update(signRequests)
    .set({
      status: 'signed',
      consentAt: now,
      consentSha256: input.consentSha256,
      signedName: input.signedName,
      signedAt: now,
      signedIp: ctx.ip,
      signedUserAgent: ctx.userAgent?.slice(0, 500) ?? null,
      viewedAt: row.viewedAt ?? now,
    })
    .where(and(...conditions))
    .returning();
  if (!signed)
    throw new HttpError(409, 'This request was already signed or changed. Reload the page.');

  const evCtx = { actor: input.signedName, ip: ctx.ip, userAgent: ctx.userAgent, at: now };
  await addEvent(signed.id, 'consented', {
    ...evCtx,
    meta: { consentSha256: input.consentSha256 },
  });
  await addEvent(signed.id, 'signed', {
    ...evCtx,
    meta: { via: ctx.via, docSha256: signed.docSha256 },
  });

  let pdf: Uint8Array | null = null;
  let final = signed;
  try {
    pdf = await buildSignedPdf({
      requestId: signed.id,
      title: signed.title,
      frozenHtml: signed.frozenHtml,
      draft: isDraftHtml(signed.frozenHtml),
      docSha256: signed.docSha256,
      consentSha256: signed.consentSha256 ?? input.consentSha256,
      signerEmail: signed.signerEmail,
      signedName: signed.signedName ?? input.signedName,
      sentByName: signed.sentByName,
      ip: signed.signedIp,
      userAgent: signed.signedUserAgent,
      sentAt: signed.sentAt,
      viewedAt: signed.viewedAt,
      consentAt: signed.consentAt,
      signedAt: signed.signedAt ?? now,
    });
    const key = signedPdfKey(signed.id);
    await uploadStore().set(key, new Blob([pdf as BlobPart]), {
      metadata: { contentType: 'application/pdf', size: pdf.byteLength },
    });
    [final] = await db()
      .update(signRequests)
      .set({ signedPdfKey: key })
      .where(eq(signRequests.id, signed.id))
      .returning();
  } catch (err) {
    console.error('[esign] signed PDF failed for', signed.id, err);
    pdf = null;
  }

  // Separate sends, so a problem with one address never costs the signer his copy.
  const copyFor = async (to: string, who: 'signer' | 'guild') => {
    const res = await sendEmail({
      to,
      email: signedCopyEmail({
        signerName: signed.signedName ?? input.signedName,
        title: signed.title,
        signedAt: guildTime(signed.signedAt),
        hasPdf: Boolean(pdf),
      }),
      template: 'sign-completed',
      related: { type: 'sign_request', id: signed.id },
      ...(pdf
        ? { attachments: [{ filename: pdfFilename(signed), content: Buffer.from(pdf) }] }
        : {}),
    });
    await addEvent(signed.id, 'emailed', {
      actor: 'system',
      meta: {
        ok: res.status === 'sent',
        to,
        copy: who,
        ...(res.status === 'sent' ? {} : { error: res.error }),
      },
    });
    return res;
  };
  const mail = await copyFor(signed.signerEmail, 'signer');
  await copyFor(GUILD_COPY_EMAIL, 'guild');

  return { row: final, pdfStored: Boolean(final.signedPdfKey), emailed: mail.status === 'sent' };
}

export function pdfFilename(row: Pick<SignRow, 'title' | 'signerName'>): string {
  const slug = `${row.title} ${row.signerName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'signed'}-signed.pdf`;
}

/** The signed PDF as a download, or null when there is none yet. */
export async function signedPdfResponse(row: SignRow): Promise<Response | null> {
  if (!row.signedAt || !row.signedPdfKey) return null;
  const blob = await readBlob(row.signedPdfKey);
  if (!blob) return null;
  return new Response(blob.bytes, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${pdfFilename(row)}"`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
}

/** Open and signed requests for one member's row: his "Paperwork to sign". */
export async function requestsForMember(memberId: string) {
  const rows = await db()
    .select(VIEW_COLUMNS)
    .from(signRequests)
    .where(and(eq(signRequests.memberId, memberId), isNull(signRequests.voidedAt)))
    .orderBy(desc(signRequests.sentAt))
    .limit(50);
  return rows.map(toView);
}

/**
 * Every live (not voided) request tied to a member, for the officer roster.
 * No row limit: a cap could drop an older signed packet and make a member
 * look like their paperwork was never sent. The rows are small (no HTML).
 */
export async function memberSignRequests(): Promise<SignRequestView[]> {
  const rows = await db()
    .select(VIEW_COLUMNS)
    .from(signRequests)
    .where(
      and(
        isNotNull(signRequests.memberId),
        isNull(signRequests.voidedAt),
        ne(signRequests.status, 'voided'),
      ),
    )
    .orderBy(desc(signRequests.sentAt));
  return rows.map(toView);
}

/** Every live request sent to an account (officer and board agreements). */
export async function accountSignRequests(userId?: string): Promise<SignRequestView[]> {
  const rows = await db()
    .select(VIEW_COLUMNS)
    .from(signRequests)
    .where(
      and(
        userId ? eq(signRequests.userId, userId) : isNotNull(signRequests.userId),
        isNull(signRequests.voidedAt),
      ),
    )
    .orderBy(desc(signRequests.sentAt));
  return rows.map(toView);
}

/** Member ids with a signed Ethical Pledge (alone or in the listing packet). */
export async function pledgeSignedMemberIds(): Promise<string[]> {
  const rows = await db()
    .selectDistinct({ memberId: signRequests.memberId })
    .from(signRequests)
    .where(
      and(
        eq(signRequests.status, 'signed'),
        isNotNull(signRequests.memberId),
        inArray(signRequests.docKind, [PACKET_KIND, 'ethical-pledge']),
      ),
    );
  return rows.map((r) => r.memberId!).filter(Boolean);
}
