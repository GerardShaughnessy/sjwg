import { boardAgreement } from './board-agreement';
import { ethicalPledge } from './ethical-pledge';
import { officerAgreement } from './officer-agreement';
import { tradesmanAgreement } from './tradesman-agreement';
import { tradesmanWaiver } from './tradesman-waiver';
import {
  BLANK_VARS,
  DRAFT_NOTICE,
  escapeHtml,
  fillDocument,
  letterheadHtml,
  renderDocHtml,
  type DocSlug,
  type GuildDocument,
  type MergeVars,
} from './types';

export * from './types';

/** The tradesman's listing paperwork, in packet order: Pledge, Waiver, Agreement. */
export const TRADESMAN_DOCUMENTS: GuildDocument[] = [
  ethicalPledge,
  tradesmanWaiver,
  tradesmanAgreement,
];

/** Agreements sent to an account (officer or director), with the person merged in. */
export const ACCOUNT_DOCUMENTS: GuildDocument[] = [officerAgreement, boardAgreement];
export type AccountDocKind = 'officer-agreement' | 'board-agreement';
export const ACCOUNT_DOC_KINDS: AccountDocKind[] = ['officer-agreement', 'board-agreement'];
export const isAccountDocKind = (v: string): v is AccountDocKind =>
  (ACCOUNT_DOC_KINDS as string[]).includes(v);

/** Every Guild document, for the /documents pages. */
export const DOCUMENTS: GuildDocument[] = [...TRADESMAN_DOCUMENTS, ...ACCOUNT_DOCUMENTS];

export function getDocText(slug: string): GuildDocument | null {
  return DOCUMENTS.find((d) => d.slug === slug) ?? null;
}

/** A document as printed on its /documents page: blanks where a name goes. */
export function printableDoc(doc: GuildDocument): GuildDocument {
  return doc.defaultDuties ? fillDocument(doc, BLANK_VARS) : doc;
}

export const PACKET_KIND = 'listing-packet';
export const PACKET_TITLE = 'Directory Listing Packet';
export type SignDocKind = typeof PACKET_KIND | DocSlug;

/** What an officer can send to a tradesman from the signing panel. */
export const SIGN_DOC_KINDS: { value: SignDocKind; label: string }[] = [
  { value: PACKET_KIND, label: 'Listing packet (Pledge + Waiver + Agreement)' },
  ...TRADESMAN_DOCUMENTS.map((d) => ({
    value: d.slug,
    label: d.draft ? `${d.title} (draft)` : d.title,
  })),
];

const ALL_LABELS: { value: string; label: string }[] = [
  ...SIGN_DOC_KINDS,
  ...ACCOUNT_DOCUMENTS.map((d) => ({ value: d.slug, label: `${d.title} (draft)` })),
];

export function isSignDocKind(v: string): v is SignDocKind {
  return SIGN_DOC_KINDS.some((k) => k.value === v);
}

/**
 * The exact HTML a signer sees and signs. A single document, or the packet:
 * all three documents in order, each under its own part heading. An account
 * agreement needs `vars` (name, title, duties).
 */
export function composeForSigning(
  kind: SignDocKind,
  vars?: MergeVars,
): {
  title: string;
  html: string;
  draft: boolean;
} {
  if (kind === PACKET_KIND) {
    const draft = TRADESMAN_DOCUMENTS.some((d) => d.draft);
    const html = [
      `<article class="guild-packet" data-doc="${PACKET_KIND}"${draft ? ' data-draft="true"' : ''}>`,
      letterheadHtml(),
      `<h1>${escapeHtml(PACKET_TITLE)}</h1>`,
      ...(draft
        ? [
            `<p class="draft-notice"><strong>${escapeHtml(DRAFT_NOTICE)}</strong> Parts marked as drafts are included for review and testing.</p>`,
          ]
        : []),
      `<p>This packet has ${TRADESMAN_DOCUMENTS.length} parts: ${TRADESMAN_DOCUMENTS.map((d, i) => `Part ${i + 1}, ${escapeHtml(d.title)}`).join('; ')}. One signature at the end applies to every part.</p>`,
      ...TRADESMAN_DOCUMENTS.map((d, i) =>
        renderDocHtml({ ...d, title: `Part ${i + 1}. ${d.title}` }, { titleLevel: 2 }),
      ),
      '</article>',
    ].join('\n');
    return { title: PACKET_TITLE, html, draft };
  }
  const doc = getDocText(kind);
  if (!doc) throw new Error(`Unknown document ${kind}`);
  if (doc.defaultDuties && !vars) throw new Error(`${kind} needs a name, title, and duties`);
  const filled = vars && doc.defaultDuties ? fillDocument(doc, vars) : doc;
  return { title: doc.title, html: renderDocHtml(filled), draft: doc.draft };
}

export function docKindLabel(kind: string): string {
  return ALL_LABELS.find((k) => k.value === kind)?.label ?? kind;
}
