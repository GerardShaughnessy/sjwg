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
  /** Who signs, for the printable page: "Signed by the tradesman:". */
  signer?: string;
  /**
   * For an account's agreement: the duties used when the person has none on
   * file. Text may hold {{name}} and {{title}}; a list item that is exactly
   * {{duties}} becomes the person's duties, one item per line.
   */
  defaultDuties?: string[];
}

export type DocSlug =
  | 'ethical-pledge'
  | 'tradesman-waiver'
  | 'tradesman-agreement'
  | 'officer-agreement'
  | 'board-agreement';

export const DRAFT_NOTICE = 'DRAFT for attorney review. Not yet in effect.';

/** The top of every Guild document, on the page and in the signed PDF. */
export const LETTERHEAD = {
  name: 'St. Joseph the Worker Guild',
  address: '744 S Third St, St. Louis, MO 63102',
  email: 'hello@sjwg.org',
  web: 'sjwg.org',
} as const;

/** The letterhead as HTML. Divs, not paragraphs, so the PDF text pass skips it and draws its own. */
export function letterheadHtml(): string {
  return [
    '<header class="doc-letterhead">',
    `<div class="doc-letterhead-name">${escapeHtml(LETTERHEAD.name)}</div>`,
    `<div>${escapeHtml(LETTERHEAD.address)}</div>`,
    `<div>${escapeHtml(LETTERHEAD.email)} | ${escapeHtml(LETTERHEAD.web)}</div>`,
    '</header>',
  ].join('');
}

/** What is merged into an account's agreement when it is sent. */
export interface MergeVars {
  name: string;
  title: string;
  /** One duty per item. Empty means the document's default duties. */
  duties: string[];
}

/** Blanks for the printable page, where nobody is named yet. */
export const BLANK_VARS: MergeVars = {
  name: '____________________',
  title: '____________________',
  duties: [],
};

/** Duties stored as text, one per line, as a clean list. */
export function dutiesFromText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*\u2022]\s*/, '').trim())
    .filter(Boolean);
}

/** The document with a person's name, title, and duties filled in. */
export function fillDocument(doc: GuildDocument, vars: MergeVars): GuildDocument {
  const duties = vars.duties.length ? vars.duties : (doc.defaultDuties ?? []);
  const sub = (t: string) =>
    t.replace(/\{\{name\}\}/g, vars.name).replace(/\{\{title\}\}/g, vars.title);
  return {
    ...doc,
    sections: doc.sections.map((sec) => ({
      ...sec,
      heading: sec.heading ? sub(sec.heading) : sec.heading,
      blocks: sec.blocks.map((b) =>
        b.type === 'p'
          ? { ...b, text: sub(b.text) }
          : { ...b, items: b.items.flatMap((i) => (i === '{{duties}}' ? duties : [sub(i)])) },
      ),
    })),
  };
}

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
export function renderDocHtml(
  doc: GuildDocument,
  opts: { titleLevel?: 1 | 2; letterhead?: boolean } = {},
): string {
  const t = opts.titleLevel ?? 1;
  const s = t + 1;
  const parts: string[] = [];
  parts.push(
    `<section class="guild-doc" data-doc="${doc.slug}" data-version="${escapeHtml(doc.version)}"${doc.draft ? ' data-draft="true"' : ''}>`,
  );
  // A document on its own carries the letterhead; the packet puts it once at the top.
  if (opts.letterhead ?? t === 1) parts.push(letterheadHtml());
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
