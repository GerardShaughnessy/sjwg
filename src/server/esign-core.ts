/**
 * Pure helpers for e-signature: tokens, hashes, consent text, and turning
 * frozen HTML into paragraphs for the PDF. No database, no network, so they
 * are easy to test.
 */
import { makeToken, sha256 } from './refs';

export const SIGN_TTL_MS = 30 * 24 * 3600 * 1000;
export const GUILD_COPY_EMAIL = 'hello@sjwg.org';
export const SIGN_TIME_ZONE = 'America/Chicago';

/** A base64url encoding of 32 random bytes. */
export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function newSignToken(now = new Date()): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const token = makeToken();
  return { token, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + SIGN_TTL_MS) };
}

/** Only well-formed tokens are hashed and looked up. */
export function hashSignToken(token: string): string | null {
  return TOKEN_PATTERN.test(token) ? sha256(token) : null;
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** The frozen document's fingerprint. Same HTML in, same hash out. */
export const docSha256 = (html: string) => sha256(html);

/* ---------------------------------------------------------------- consent */
export const ESIGN_CONSENT_VERSION = '2026-11-21';
export const ESIGN_CONSENT_TEXT = [
  'Consent to use electronic records and signatures.',
  'St. Joseph the Worker Guild would like to give you this document and get your signature electronically. By agreeing, you consent to receive the document, sign it, and get your signed copy electronically instead of on paper.',
  'Your typed name will be your signature. It has the same effect as signing a paper copy by hand.',
  'You will need a device with a web browser and an email account to view, sign, and keep a copy. A signed PDF copy will be emailed to you when you sign.',
  'You may ask for a paper copy of this document, before or after signing, at no charge, by writing to hello@sjwg.org.',
  'You may withdraw this consent at any time before you sign by closing this page and writing to hello@sjwg.org. Withdrawing consent does not affect anything already signed.',
  'If your email address changes, tell us at hello@sjwg.org.',
];
/** Hash of the versioned consent text. Stored with each signature. */
export const ESIGN_CONSENT_SHA256 = sha256(
  `${ESIGN_CONSENT_VERSION}\n${ESIGN_CONSENT_TEXT.join('\n')}`,
);

/* ---------------------------------------------------------------- states */
export type SignStatus = 'sent' | 'viewed' | 'signed' | 'voided';

export type SignGate = 'open' | 'signed' | 'voided' | 'expired';

/** Can this request be signed through its emailed link right now? */
export function linkState(
  row: { status: string; tokenExpiresAt: Date; signedAt: Date | null; voidedAt: Date | null },
  now = new Date(),
): SignGate {
  if (row.signedAt || row.status === 'signed') return 'signed';
  if (row.voidedAt || row.status === 'voided') return 'voided';
  if (isExpired(row.tokenExpiresAt, now)) return 'expired';
  return 'open';
}

/* ---------------------------------------------------------- HTML to text */
export type Para = { kind: 'h1' | 'h2' | 'h3' | 'p' | 'li'; text: string; marker?: string };

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Our own frozen HTML (headings, paragraphs, lists) as an ordered list of
 * paragraphs. Ordered list items get their number as a marker.
 */
export function htmlToParagraphs(html: string): Para[] {
  const out: Para[] = [];
  const re =
    /<(h1|h2|h3|p|li|ol|ul|\/ol|\/ul)\b[^>]*>([\s\S]*?)(?=<(?:h1|h2|h3|p|li|ol|ul|\/ol|\/ul|\/section|\/article|section|article)\b|$)/gi;
  const listStack: { ordered: boolean; n: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === 'ol' || tag === 'ul') {
      listStack.push({ ordered: tag === 'ol', n: 0 });
      continue;
    }
    if (tag === '/ol' || tag === '/ul') {
      listStack.pop();
      continue;
    }
    const text = decode(m[2]);
    if (!text) continue;
    if (tag === 'li') {
      const list = listStack[listStack.length - 1];
      const marker = list?.ordered ? `${++list.n}.` : '-';
      out.push({ kind: 'li', text, marker });
    } else {
      out.push({ kind: tag as Para['kind'], text });
    }
  }
  return out;
}

/** "November 21, 2026 at 3:04 PM CST" in Guild time. */
export function guildTime(d: Date | null | undefined): string {
  if (!d) return 'not recorded';
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: SIGN_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(d);
  return s;
}
