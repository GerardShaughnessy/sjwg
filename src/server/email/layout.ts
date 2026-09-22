import { SITE_NAME, PARISH_NAME, PARISH_CITY } from '@/config/site';

export interface Email {
  subject: string;
  text: string;
  html: string;
}

export function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

/** Paragraphs from plain text, HTML-escaped, blank lines separate them. */
export function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:17px;line-height:1.55;color:#2b2624">${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`,
    )
    .join('');
}

export function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#8c3a2e;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;padding:14px 26px">${escapeHtml(label)}</a></p>`;
}

/**
 * Table layout, system fonts, charcoal band, brass rule, stone ground.
 * Every template passes its body as HTML built with the helpers above and a
 * plain-text twin, so both versions say the same thing.
 */
export function shell({
  title,
  bodyHtml,
  footerNote,
}: {
  title: string;
  bodyHtml: string;
  footerNote?: string;
}): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#efeae4;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efeae4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="background:#2b2624;padding:22px 28px;border-bottom:3px solid #b08d57">
  <div style="font-family:Georgia,serif;font-size:20px;letter-spacing:0.02em;color:#efeae4;text-transform:uppercase">${escapeHtml(SITE_NAME)}</div>
  <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#b08d57;margin-top:4px">${escapeHtml(PARISH_NAME)}, ${escapeHtml(PARISH_CITY)}</div>
</td></tr>
<tr><td style="background:#ffffff;padding:32px 28px;font-family:Arial,Helvetica,sans-serif">
  <h1 style="margin:0 0 20px 0;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.2;color:#2b2624">${escapeHtml(title)}</h1>
  ${bodyHtml}
</td></tr>
<tr><td style="padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#6e6560">
  ${footerNote ? escapeHtml(footerNote) : `${escapeHtml(SITE_NAME)}. ${escapeHtml(PARISH_NAME)}, ${escapeHtml(PARISH_CITY)}.`}
</td></tr>
</table></td></tr></table></body></html>`;
}

export function textFooter(): string {
  return `\n\n${SITE_NAME}\n${PARISH_NAME}, ${PARISH_CITY}`;
}
