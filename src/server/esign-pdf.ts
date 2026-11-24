import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { DRAFT_NOTICE, LETTERHEAD } from '@/config/documents/types';
import { guildTime, htmlToParagraphs } from './esign-core';

/**
 * The signed copy: the document text, the signature block, and an audit page.
 * Letter size, standard fonts (no font files to ship).
 */
export interface SignedPdfInput {
  requestId: string;
  title: string;
  frozenHtml: string;
  draft: boolean;
  docSha256: string;
  consentSha256: string;
  signerEmail: string;
  signedName: string;
  sentByName: string;
  ip: string | null;
  userAgent: string | null;
  sentAt: Date;
  viewedAt: Date | null;
  consentAt: Date | null;
  signedAt: Date;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 60;
const BODY = 10.5;
const LEADING = 14.5;
const FOOT = 8.5;

/** Standard fonts only encode WinAnsi. Map the usual typographic characters, drop the rest. */
export function pdfSafe(text: string): string {
  return text
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—−]/g, '-')
    .replace(/•/g, '-')
    .replace(/[    ]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7e\xa1-\xff]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;
  for (const word of text.split(' ').filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    let w = word;
    while (!fits(w) && w.length > 1) {
      let n = w.length - 1;
      while (n > 1 && !fits(w.slice(0, n))) n--;
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    line = w;
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildSignedPdf(input: SignedPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${input.title} (signed)`));
  doc.setAuthor('St. Joseph the Worker Guild');
  doc.setSubject(`Signed by ${pdfSafe(input.signedName)}`);
  doc.setCreationDate(input.signedAt);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.16, 0.15, 0.1);
  const muted = rgb(0.42, 0.39, 0.31);
  const maxW = PAGE_W - MARGIN * 2;

  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN) newPage();
  };
  const text = (
    raw: string,
    opts: { f?: PDFFont; size?: number; indent?: number; lead?: number; color?: typeof ink } = {},
  ) => {
    const f = opts.f ?? font;
    const size = opts.size ?? BODY;
    const indent = opts.indent ?? 0;
    const lead = opts.lead ?? Math.max(LEADING, size * 1.3);
    for (const l of wrap(pdfSafe(raw), f, size, maxW - indent)) {
      ensure(lead);
      page.drawText(l, {
        x: MARGIN + indent,
        y: y - size,
        size,
        font: f,
        color: opts.color ?? ink,
      });
      y -= lead;
    }
  };

  // Letterhead, drawn here for every document (older frozen copies included)
  const center = (raw: string, f: PDFFont, size: number, color: typeof ink) => {
    const t = pdfSafe(raw);
    page.drawText(t, {
      x: (PAGE_W - f.widthOfTextAtSize(t, size)) / 2,
      y: y - size,
      size,
      font: f,
      color,
    });
    y -= size * 1.35;
  };
  center(LETTERHEAD.name, bold, 15, ink);
  center(LETTERHEAD.address, sans, 9, muted);
  center(`${LETTERHEAD.email}  |  ${LETTERHEAD.web}`, sans, 9, muted);
  y -= 4;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: muted,
  });
  y -= 10;

  // Document text
  for (const para of htmlToParagraphs(input.frozenHtml)) {
    switch (para.kind) {
      case 'h1':
        y -= 6;
        ensure(40);
        text(para.text, { f: bold, size: 17, lead: 21 });
        y -= 4;
        break;
      case 'h2':
        y -= 8;
        ensure(36);
        text(para.text, { f: bold, size: 13.5, lead: 17 });
        y -= 2;
        break;
      case 'h3':
        y -= 5;
        ensure(32);
        text(para.text, { f: bold, size: 11.5, lead: 15 });
        break;
      case 'li': {
        const marker = para.marker ?? '-';
        ensure(LEADING);
        page.drawText(pdfSafe(marker), {
          x: MARGIN + 6,
          y: y - BODY,
          size: BODY,
          font,
          color: ink,
        });
        text(para.text, { indent: 24 });
        y -= 2;
        break;
      }
      default:
        text(para.text);
        y -= 5;
    }
  }

  // Signature block
  y -= 14;
  ensure(150);
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.75,
    color: muted,
  });
  y -= 18;
  text('Signature', { f: bold, size: 13.5, lead: 18 });
  y -= 4;
  text(input.signedName, { f: bold, size: 16, lead: 22 });
  text(
    `Signed electronically by ${input.signedName} (${input.signerEmail}) on ${guildTime(input.signedAt)}.`,
  );
  text(
    `Sent for the Guild by ${input.sentByName}, St. Joseph the Worker Guild, on ${guildTime(input.sentAt)}.`,
  );
  y -= 4;
  text(
    'The signer agreed to use electronic records and signatures and typed the name above as a signature. The audit record on the last page is part of this signed copy.',
    { size: 9.5, color: muted },
  );

  // Audit page
  newPage();
  text('Audit record', { f: bold, size: 15, lead: 20 });
  y -= 4;
  const rows: [string, string][] = [
    ['Document', input.title],
    ['Request id', input.requestId],
    ['Document SHA-256', input.docSha256],
    ['Consent SHA-256', input.consentSha256],
    ['Signer', `${input.signedName} <${input.signerEmail}>`],
    ['Sent by', input.sentByName],
    ['Sent', guildTime(input.sentAt)],
    ['First viewed', guildTime(input.viewedAt)],
    ['Consented', guildTime(input.consentAt)],
    ['Signed', guildTime(input.signedAt)],
    ['Signed at (UTC)', input.signedAt.toISOString()],
    ['IP address', input.ip ?? 'not recorded'],
    ['Browser', input.userAgent ?? 'not recorded'],
  ];
  for (const [label, value] of rows) {
    ensure(LEADING * 2);
    page.drawText(pdfSafe(label), { x: MARGIN, y: y - 9.5, size: 9.5, font: sans, color: muted });
    const lines = wrap(pdfSafe(value), sans, 9.5, maxW - 120);
    for (const l of lines) {
      ensure(13);
      page.drawText(l, { x: MARGIN + 120, y: y - 9.5, size: 9.5, font: sans, color: ink });
      y -= 13;
    }
    y -= 3;
  }
  y -= 8;
  text(
    'The document SHA-256 is the fingerprint of the exact text shown to the signer. The consent SHA-256 is the fingerprint of the electronic records consent the signer accepted. Signed under the federal E-SIGN Act (15 U.S.C. 7001 and following) and the Missouri Uniform Electronic Transactions Act.',
    { size: 9.5, color: muted },
  );

  // Footer and, for drafts, a watermark on every page
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    const label = pdfSafe(
      `${input.title}  |  Page ${i + 1} of ${pages.length}  |  Request ${input.requestId}`,
    );
    const w = sans.widthOfTextAtSize(label, FOOT);
    pg.drawText(label, {
      x: (PAGE_W - w) / 2,
      y: MARGIN / 2,
      size: FOOT,
      font: sans,
      color: muted,
    });
    if (input.draft) {
      pg.drawText('DRAFT', {
        x: 150,
        y: 260,
        size: 120,
        font: bold,
        color: rgb(0.8, 0.2, 0.15),
        opacity: 0.12,
        rotate: degrees(40),
      });
      const n = pdfSafe(DRAFT_NOTICE);
      const nw = sans.widthOfTextAtSize(n, FOOT);
      pg.drawText(n, {
        x: (PAGE_W - nw) / 2,
        y: PAGE_H - MARGIN / 2,
        size: FOOT,
        font: sans,
        color: rgb(0.6, 0.15, 0.1),
      });
    }
  });

  return doc.save();
}
