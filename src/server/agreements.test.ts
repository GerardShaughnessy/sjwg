import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_DOCUMENTS,
  DRAFT_NOTICE,
  LETTERHEAD,
  composeForSigning,
  dutiesFromText,
  getDocText,
  printableDoc,
  renderDocHtml,
} from '@/config/documents';
import {
  agreementIsStale,
  agreementNoLongerApplies,
  agreementStatus,
  agreementVars,
  assertCanSignInPortal,
  canSeeSignRequest,
  canSignInPortal,
  requiredAgreements,
} from './agreement-rules';
import { docSha256 } from './esign-core';
import { HttpError } from './http';
import { htmlToParagraphs } from './esign-core';
import { buildSignedPdf } from './esign-pdf';

const OWNER = { userId: 'u-owner', memberId: null };
const OTHER = { userId: 'u-other', memberId: 'm-other' };

function statusOf(fn: () => void): number | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
}

describe('signing an account agreement from the portal', () => {
  const row = { userId: 'u-owner', memberId: null };
  it('lets the account it was sent to sign', () => {
    expect(canSignInPortal(OWNER, row)).toBe(true);
    expect(statusOf(() => assertCanSignInPortal(OWNER, row))).toBeNull();
  });
  it('refuses everyone else with a 403', () => {
    expect(canSignInPortal(OTHER, row)).toBe(false);
    expect(statusOf(() => assertCanSignInPortal(OTHER, row))).toBe(403);
    // A session with no member row never matches a request with no member row.
    expect(statusOf(() => assertCanSignInPortal({ userId: 'x', memberId: null }, row))).toBe(403);
  });
  it('still lets a tradesman sign paperwork for their own directory entry', () => {
    const t = { userId: null, memberId: 'm-other' };
    expect(statusOf(() => assertCanSignInPortal(OTHER, t))).toBeNull();
    expect(statusOf(() => assertCanSignInPortal(OWNER, t))).toBe(403);
  });
});

describe('merged agreements', () => {
  const vars = {
    name: 'Pat Example',
    title: 'Secretary',
    duties: dutiesFromText('Keep the minutes\n- Send the agenda\n\n  File the annual report  '),
  };
  it('reads duties one per line, dropping bullets and blanks', () => {
    expect(vars.duties).toEqual(['Keep the minutes', 'Send the agenda', 'File the annual report']);
  });
  it('puts the name, title, and each duty into the officer agreement', () => {
    const { html, draft, title } = composeForSigning('officer-agreement', vars);
    expect(title).toBe('Officer Agreement');
    expect(draft).toBe(true);
    expect(html).toContain('Pat Example');
    expect(html).toContain('The Officer will serve as Secretary of the Guild.');
    for (const d of vars.duties) expect(html).toContain(`<li>${d}</li>`);
    expect(html).not.toContain('{{');
  });
  it('puts the board title and duties into the board agreement', () => {
    const { html } = composeForSigning('board-agreement', { ...vars, title: 'Treasurer' });
    expect(html).toContain('as Treasurer.');
    expect(html).toContain('<li>Send the agenda</li>');
  });
  it('uses a generic list when no duties are on file', () => {
    const { html } = composeForSigning('officer-agreement', { ...vars, duties: [] });
    const doc = getDocText('officer-agreement')!;
    for (const d of doc.defaultDuties!) expect(html).toContain(d.replace(/'/g, '&#39;'));
  });
  it('needs a person to be sent', () => {
    expect(() => composeForSigning('officer-agreement')).toThrow();
  });
  it('both are drafts and carry the DRAFT notice', () => {
    for (const d of ACCOUNT_DOCUMENTS) {
      expect(d.draft).toBe(true);
      const html = renderDocHtml(printableDoc(d));
      expect(html).toContain(DRAFT_NOTICE);
      expect(html).toContain('data-draft="true"');
      expect(html).not.toMatch(/—/);
      expect(html).not.toMatch(/\b(he|she|his|her|him)\b/i);
    }
  });
  it('every document starts with the letterhead, which the PDF text pass skips', () => {
    const { html } = composeForSigning('officer-agreement', vars);
    expect(html).toContain(LETTERHEAD.address);
    expect(html).toContain('hello@sjwg.org');
    expect(htmlToParagraphs(html)[0]).toEqual({ kind: 'h1', text: 'Officer Agreement' });
    expect(composeForSigning('listing-packet').html.match(/doc-letterhead"/g)).toHaveLength(1);
  });
  it('builds a signed PDF', async () => {
    const { html, title } = composeForSigning('board-agreement', vars);
    const bytes = await buildSignedPdf({
      requestId: '00000000-0000-4000-8000-000000000001',
      title,
      frozenHtml: html,
      draft: true,
      docSha256: 'a'.repeat(64),
      consentSha256: 'b'.repeat(64),
      signerEmail: 'pat@example.com',
      signedName: 'Pat Example',
      sentByName: 'The Admin',
      ip: null,
      userAgent: null,
      sentAt: new Date(),
      viewedAt: null,
      consentAt: new Date(),
      signedAt: new Date(),
    });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});

describe('who needs which agreement', () => {
  const base = { id: 'u', role: 'member' as const, siteAdmin: false, director: false };
  it('officers need the officer agreement, directors the board agreement', () => {
    expect(requiredAgreements(base)).toEqual([]);
    expect(requiredAgreements({ ...base, role: 'admin' })).toEqual(['officer-agreement']);
    expect(requiredAgreements({ ...base, director: true })).toEqual(['board-agreement']);
    expect(requiredAgreements({ ...base, role: 'admin', director: true })).toEqual([
      'officer-agreement',
      'board-agreement',
    ]);
  });
  it('the Admin is not an officer, and a disabled account needs nothing', () => {
    expect(requiredAgreements({ ...base, role: 'admin', siteAdmin: true })).toEqual([]);
    expect(requiredAgreements({ ...base, role: 'admin', disabled: true })).toEqual([]);
  });
  it('a signed copy wins over a newer open request, and voided ones do not count', () => {
    const r = (o: object) => ({
      id: 'r',
      docKind: 'officer-agreement',
      userId: 'u',
      status: 'sent',
      sentAt: '2026-11-01T00:00:00Z',
      signedAt: null,
      voidedAt: null,
      hasPdf: false,
      ...o,
    });
    expect(agreementStatus([], 'u', 'officer-agreement').state).toBe('not_sent');
    expect(
      agreementStatus([r({ voidedAt: '2026-11-02', status: 'voided' })], 'u', 'officer-agreement')
        .state,
    ).toBe('not_sent');
    expect(agreementStatus([r({})], 'u', 'officer-agreement').state).toBe('sent');
    const st = agreementStatus(
      [
        r({ id: 'new', sentAt: '2026-11-05T00:00:00Z' }),
        r({ id: 'old', status: 'signed', signedAt: '2026-11-02T00:00:00Z', hasPdf: true }),
      ],
      'u',
      'officer-agreement',
    );
    expect(st).toMatchObject({ state: 'signed', requestId: 'old', hasPdf: true });
    expect(agreementStatus([r({})], 'someone-else', 'officer-agreement').state).toBe('not_sent');
    expect(agreementStatus([r({})], 'u', 'board-agreement').state).toBe('not_sent');
  });
});

describe('resending an agreement after the person changed', () => {
  const pat = {
    name: 'Pat Example',
    email: 'pat@example.com',
    title: 'Secretary',
    boardTitle: '',
    duties: 'Keep the minutes\nSend the agenda',
  };
  const frozen = (u: typeof pat, kind: 'officer-agreement' | 'board-agreement') => ({
    docKind: kind,
    docSha256: docSha256(composeForSigning(kind, agreementVars(u, kind)).html),
  });
  const row = frozen(pat, 'officer-agreement');

  it('resends as before when nothing changed', () => {
    expect(agreementIsStale(row, pat)).toBe(false);
    // Whitespace and bullets in the duties box do not count as a change.
    expect(
      agreementIsStale(row, { ...pat, duties: '- Keep the minutes\n\n Send the agenda ' }),
    ).toBe(false);
  });
  it('sends fresh when the name, title, or duties changed', () => {
    expect(agreementIsStale(row, { ...pat, name: 'Patricia Example' })).toBe(true);
    expect(agreementIsStale(row, { ...pat, title: 'Treasurer' })).toBe(true);
    expect(agreementIsStale(row, { ...pat, duties: 'Keep the minutes' })).toBe(true);
  });
  it('a board title change matters only to the board agreement', () => {
    const board = frozen({ ...pat, boardTitle: 'Chair' }, 'board-agreement');
    expect(agreementIsStale(board, { ...pat, boardTitle: 'Chair' })).toBe(false);
    expect(agreementIsStale(board, { ...pat, boardTitle: 'Vice Chair' })).toBe(true);
    expect(agreementIsStale(row, { ...pat, boardTitle: 'Vice Chair' })).toBe(false);
  });
});

describe('who sees an officer or board agreement', () => {
  const admin = { userId: 'a', role: 'admin' as const, siteAdmin: true, memberId: null };
  const officer = { userId: 'o', role: 'admin' as const, siteAdmin: false, memberId: null };
  const signer = { userId: 's', role: 'admin' as const, siteAdmin: false, memberId: null };
  const agreement = { docKind: 'officer-agreement', userId: 's', memberId: null };
  it('the Admin and the signer only', () => {
    expect(canSeeSignRequest(admin, agreement)).toBe(true);
    expect(canSeeSignRequest(signer, agreement)).toBe(true);
    expect(canSeeSignRequest(officer, agreement)).toBe(false);
  });
  it('an orphaned agreement (account deleted) stays Admin-only', () => {
    const orphan = { ...agreement, userId: null };
    expect(canSeeSignRequest(admin, orphan)).toBe(true);
    expect(canSeeSignRequest(officer, orphan)).toBe(false);
  });
  it('tradesman paperwork: every officer and the tradesman', () => {
    const packet = { docKind: 'listing-packet', userId: null, memberId: 'm1' };
    expect(canSeeSignRequest(officer, packet)).toBe(true);
    expect(
      canSeeSignRequest({ userId: 't', role: 'member', siteAdmin: false, memberId: 'm1' }, packet),
    ).toBe(true);
    expect(
      canSeeSignRequest({ userId: 'x', role: 'member', siteAdmin: false, memberId: 'm2' }, packet),
    ).toBe(false);
  });
});

describe('signing an agreement after leaving the role', () => {
  const base = {
    id: 'u',
    role: 'admin' as const,
    siteAdmin: false,
    director: false,
    disabled: false,
  };
  it('an officer still in office may sign', () => {
    expect(agreementNoLongerApplies('officer-agreement', base)).toBeNull();
  });
  it('refuses someone demoted, off the board, disabled, or deleted', () => {
    expect(agreementNoLongerApplies('officer-agreement', { ...base, role: 'member' })).toMatch(
      /no longer listed as an officer/,
    );
    expect(agreementNoLongerApplies('board-agreement', base)).toMatch(
      /no longer listed on the board/,
    );
    expect(agreementNoLongerApplies('board-agreement', { ...base, director: true })).toBeNull();
    expect(agreementNoLongerApplies('officer-agreement', { ...base, disabled: true })).toMatch(
      /not active/,
    );
    expect(agreementNoLongerApplies('officer-agreement', null)).toMatch(/not active/);
  });
});
