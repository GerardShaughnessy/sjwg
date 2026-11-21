/**
 * Guild documents as structured text. One source of truth for the printable
 * pages (/documents/<slug>) and for the HTML that is frozen and hashed when a
 * document is sent for e-signature. Plain text only: the renderer escapes it.
 */
export type Block =
  { type: 'p'; text: string } | { type: 'list'; items: string[]; ordered?: boolean };

export interface Section {
  heading?: string;
  blocks: Block[];
}

export interface GuildDocument {
  slug: DocSlug;
  title: string;
  /** Bump when the wording changes. Shown on the page and frozen into signed copies. */
  version: string;
  /** Drafts carry a banner and watermark and are not yet in effect. */
  draft: boolean;
  /** One line for the index page. */
  summary: string;
  sections: Section[];
}

export type DocSlug = 'ethical-pledge' | 'tradesman-waiver' | 'tradesman-agreement';

export const DRAFT_NOTICE = 'DRAFT for attorney review. Not yet in effect.';

export const p = (text: string): Block => ({ type: 'p', text });
export const ol = (...items: string[]): Block => ({ type: 'list', items, ordered: true });
export const ul = (...items: string[]): Block => ({ type: 'list', items });

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function blockHtml(b: Block): string {
  if (b.type === 'p') return `<p>${escapeHtml(b.text)}</p>`;
  const tag = b.ordered ? 'ol' : 'ul';
  return `<${tag}>${b.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>`;
}

/**
 * The document body as HTML. Deterministic: the same document always gives the
 * same string, so its sha256 is stable. `titleLevel` lets the packet nest each
 * document under its own part heading.
 */
export function renderDocHtml(doc: GuildDocument, opts: { titleLevel?: 1 | 2 } = {}): string {
  const t = opts.titleLevel ?? 1;
  const s = t + 1;
  const parts: string[] = [];
  parts.push(
    `<section class="guild-doc" data-doc="${doc.slug}" data-version="${escapeHtml(doc.version)}"${doc.draft ? ' data-draft="true"' : ''}>`,
  );
  parts.push(`<h${t}>${escapeHtml(doc.title)}</h${t}>`);
  if (doc.draft)
    parts.push(`<p class="draft-notice"><strong>${escapeHtml(DRAFT_NOTICE)}</strong></p>`);
  parts.push(
    `<p class="doc-meta">St. Joseph the Worker Guild. Version ${escapeHtml(doc.version)}.</p>`,
  );
  for (const sec of doc.sections) {
    if (sec.heading) parts.push(`<h${s}>${escapeHtml(sec.heading)}</h${s}>`);
    for (const b of sec.blocks) parts.push(blockHtml(b));
  }
  parts.push('</section>');
  return parts.join('\n');
}
