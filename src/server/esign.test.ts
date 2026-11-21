import { describe, expect, it } from 'vitest';
import {
  ESIGN_CONSENT_SHA256,
  SIGN_TTL_MS,
  docSha256,
  hashSignToken,
  htmlToParagraphs,
  isExpired,
  linkState,
  newSignToken,
} from './esign-core';
import { buildSignedPdf, pdfSafe } from './esign-pdf';
import {
  documentReviewSchema,
  documentUploadSchema,
  sendForSignatureSchema,
  signSchema,
} from './esign-schemas';
import { sha256 } from './refs';
import { DOCUMENTS, composeForSigning, getDocText, renderDocHtml } from '@/config/documents';

describe('sign tokens', () => {
  it('stores only the sha256 and expires in 30 days', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    const t = newSignToken(now);
    expect(t.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(t.tokenHash).toBe(sha256(t.token));
    expect(t.tokenHash).not.toContain(t.token);
    expect(t.expiresAt.getTime() - now.getTime()).toBe(SIGN_TTL_MS);
    expect(SIGN_TTL_MS).toBe(30 * 24 * 3600 * 1000);
  });
  it('hashes only well-formed tokens', () => {
    const t = newSignToken();
    expect(hashSignToken(t.token)).toBe(t.tokenHash);
    expect(hashSignToken('short')).toBeNull();
    expect(hashSignToken(`${t.token}x`)).toBeNull();
    expect(hashSignToken('../../etc/passwd/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBeNull();
  });
  it('knows when a link has expired', () => {
    const now = new Date('2026-11-21T12:00:00Z');
    expect(isExpired(new Date('2026-11-21T11:59:59Z'), now)).toBe(true);
    expect(isExpired(new Date('2026-11-21T12:00:00Z'), now)).toBe(true);
    expect(isExpired(new Date('2026-11-21T12:00:01Z'), now)).toBe(false);
  });
  it('gates links by state', () => {
    const base = {
      status: 'sent',
      tokenExpiresAt: new Date(Date.now() + 1000),
      signedAt: null,
      voidedAt: null,
    };
    expect(linkState(base)).toBe('open');
    expect(linkState({ ...base, status: 'viewed' })).toBe('open');
    expect(linkState({ ...base, signedAt: new Date(), status: 'signed' })).toBe('signed');
    expect(linkState({ ...base, voidedAt: new Date(), status: 'voided' })).toBe('voided');
    expect(linkState({ ...base, tokenExpiresAt: new Date(Date.now() - 1000) })).toBe('expired');
  });
});

describe('frozen documents', () => {
  it('gives the same hash for the same input', () => {
    const a = composeForSigning('listing-packet');
    const b = composeForSigning('listing-packet');
    expect(a.html).toBe(b.html);
    expect(docSha256(a.html)).toBe(docSha256(b.html));
    expect(docSha256(a.html)).toMatch(/^[a-f0-9]{64}$/);
    expect(docSha256(`${a.html} `)).not.toBe(docSha256(a.html));
  });
  it('puts the packet in order: Pledge, Waiver, Agreement', () => {
    const { html, draft, title } = composeForSigning('listing-packet');
    expect(title).toBe('Directory Listing Packet');
    expect(draft).toBe(true);
    const i1 = html.indexOf('Part 1. Ethical Pledge');
    const i2 = html.indexOf('Part 2. Tradesman Waiver and Release');
    const i3 = html.indexOf('Part 3. Tradesman Listing Agreement');
    expect(i1).toBeGreaterThan(0);
    expect(i2).toBeGreaterThan(i1);
    expect(i3).toBeGreaterThan(i2);
  });
  it('marks drafts and keeps membership wording out of the pledge', () => {
    expect(composeForSigning('ethical-pledge').draft).toBe(false);
    expect(composeForSigning('tradesman-waiver').html).toContain(
      'DRAFT for attorney review. Not yet in effect.',
    );
    const pledge = renderDocHtml(getDocText('ethical-pledge')!);
    expect(pledge).not.toMatch(/\bmember(s|ship)?\b/i);
    expect(pledge).not.toMatch(/\bdues\b/i);
    expect(pledge).toMatch(/not a legal or implied guarantee/);
  });
  it('has no em dashes in any document', () => {
    for (const d of DOCUMENTS) expect(renderDocHtml(d)).not.toMatch(/—/);
  });
  it('turns frozen HTML into paragraphs with numbered list items', () => {
    const paras = htmlToParagraphs(composeForSigning('tradesman-agreement').html);
    expect(paras[0]).toEqual({ kind: 'h1', text: 'Tradesman Listing Agreement' });
    expect(paras.some((p) => p.kind === 'h2' && p.text === '1. I am independent')).toBe(true);
    const items = paras.filter((p) => p.kind === 'li');
    expect(items[0].marker).toBe('1.');
    expect(paras.every((p) => !/[<>]/.test(p.text))).toBe(true);
    expect(htmlToParagraphs('<p>Tom &amp; Jerry&#39;s</p>')).toEqual([
      { kind: 'p', text: "Tom & Jerry's" },
    ]);
  });
});

describe('signed PDF', () => {
  it('builds a valid PDF with the audit page', async () => {
    const { html, title } = composeForSigning('listing-packet');
    const bytes = await buildSignedPdf({
      requestId: '00000000-0000-4000-8000-000000000000',
      title,
      frozenHtml: html,
      draft: true,
      docSha256: docSha256(html),
      consentSha256: ESIGN_CONSENT_SHA256,
      signerEmail: 'test-signer@example.com',
      signedName: 'Test Signer — “Jr.” \u{1F600}',
      sentByName: 'An Officer',
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0 (test)',
      sentAt: new Date('2026-11-20T15:00:00Z'),
      viewedAt: new Date('2026-11-21T15:00:00Z'),
      consentAt: new Date('2026-11-21T15:05:00Z'),
      signedAt: new Date('2026-11-21T15:05:00Z'),
    });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(5000);
  });
  it('maps characters standard fonts cannot draw', () => {
    expect(pdfSafe('a — “b” ’c')).toBe('a - "b" \'c');
    expect(pdfSafe('x\u{1F600}y')).toBe('x??y');
  });
});

describe('sign endpoint validation', () => {
  const ok = {
    consent: true,
    consentSha256: ESIGN_CONSENT_SHA256,
    signedName: '  Joseph Carpenter ',
    agree: true,
    docSha256: 'a'.repeat(64),
  };
  it('accepts a complete body and trims the name', () => {
    const r = signSchema.safeParse(ok);
    expect(r.success).toBe(true);
    expect(r.success && r.data.signedName).toBe('Joseph Carpenter');
  });
  it('requires consent, agreement, a name, and both hashes', () => {
    expect(signSchema.safeParse({ ...ok, consent: false }).success).toBe(false);
    expect(signSchema.safeParse({ ...ok, agree: 'yes' }).success).toBe(false);
    expect(signSchema.safeParse({ ...ok, signedName: ' ' }).success).toBe(false);
    expect(signSchema.safeParse({ ...ok, signedName: 'x'.repeat(121) }).success).toBe(false);
    expect(signSchema.safeParse({ ...ok, docSha256: 'nothex' }).success).toBe(false);
    expect(signSchema.safeParse({ ...ok, consentSha256: undefined }).success).toBe(false);
  });
  it('checks the send and document schemas', () => {
    expect(
      sendForSignatureSchema.safeParse({
        docKind: 'listing-packet',
        name: 'A',
        email: 'a@example.com',
      }).success,
    ).toBe(true);
    expect(
      sendForSignatureSchema.safeParse({ docKind: 'homeowner', name: 'A', email: 'a@example.com' })
        .success,
    ).toBe(false);
    expect(
      sendForSignatureSchema.safeParse({ docKind: 'ethical-pledge', name: 'A', email: 'nope' })
        .success,
    ).toBe(false);
    expect(
      documentUploadSchema.safeParse({ kind: 'insurance', expiresOn: '2027-06-30' }).success,
    ).toBe(true);
    expect(documentUploadSchema.safeParse({ kind: 'passport' }).success).toBe(false);
    expect(documentReviewSchema.safeParse({ status: 'verified', expiresOn: null }).success).toBe(
      true,
    );
    expect(documentReviewSchema.safeParse({ expiresOn: '2027-13-45' }).success).toBe(false);
  });
});
