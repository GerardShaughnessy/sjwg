import { ethicalPledge } from './ethical-pledge';
import { tradesmanAgreement } from './tradesman-agreement';
import { tradesmanWaiver } from './tradesman-waiver';
import { DRAFT_NOTICE, escapeHtml, renderDocHtml, type DocSlug, type GuildDocument } from './types';

export * from './types';

/** In packet order: Pledge, Waiver, Agreement. */
export const DOCUMENTS: GuildDocument[] = [ethicalPledge, tradesmanWaiver, tradesmanAgreement];

export function getDocText(slug: string): GuildDocument | null {
  return DOCUMENTS.find((d) => d.slug === slug) ?? null;
}

export const PACKET_KIND = 'listing-packet';
export const PACKET_TITLE = 'Directory Listing Packet';
export type SignDocKind = typeof PACKET_KIND | DocSlug;

export const SIGN_DOC_KINDS: { value: SignDocKind; label: string }[] = [
  { value: PACKET_KIND, label: 'Listing packet (Pledge + Waiver + Agreement)' },
  ...DOCUMENTS.map((d) => ({ value: d.slug, label: d.draft ? `${d.title} (draft)` : d.title })),
];

export function isSignDocKind(v: string): v is SignDocKind {
  return SIGN_DOC_KINDS.some((k) => k.value === v);
}

/**
 * The exact HTML a signer sees and signs. A single document, or the packet:
 * all three documents in order, each under its own part heading.
 */
export function composeForSigning(kind: SignDocKind): {
  title: string;
  html: string;
  draft: boolean;
} {
  if (kind === PACKET_KIND) {
    const draft = DOCUMENTS.some((d) => d.draft);
    const html = [
      `<article class="guild-packet" data-doc="${PACKET_KIND}"${draft ? ' data-draft="true"' : ''}>`,
      `<h1>${escapeHtml(PACKET_TITLE)}</h1>`,
      ...(draft
        ? [
            `<p class="draft-notice"><strong>${escapeHtml(DRAFT_NOTICE)}</strong> Parts marked as drafts are included for review and testing.</p>`,
          ]
        : []),
      `<p>This packet has ${DOCUMENTS.length} parts: ${DOCUMENTS.map((d, i) => `Part ${i + 1}, ${escapeHtml(d.title)}`).join('; ')}. One signature at the end applies to every part.</p>`,
      ...DOCUMENTS.map((d, i) =>
        renderDocHtml({ ...d, title: `Part ${i + 1}. ${d.title}` }, { titleLevel: 2 }),
      ),
      '</article>',
    ].join('\n');
    return { title: PACKET_TITLE, html, draft };
  }
  const doc = getDocText(kind);
  if (!doc) throw new Error(`Unknown document ${kind}`);
  return { title: doc.title, html: renderDocHtml(doc), draft: doc.draft };
}

export function docKindLabel(kind: string): string {
  return SIGN_DOC_KINDS.find((k) => k.value === kind)?.label ?? kind;
}
