/**
 * Title Case for event titles: every word capitalized except short joining
 * words in the middle ("St. Joseph the Worker Procession"). Words that already
 * carry capitals inside them (SJWG, McBride) are left alone.
 */
const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to', 'with']);

export function titleCase(input: string): string {
  const words = input.trim().split(/\s+/);
  return words
    .map((w, i) => {
      if (/[A-Z]/.test(w.slice(1))) return w; // SJWG, McBride, O'Neil
      const lower = w.toLowerCase();
      if (i > 0 && i < words.length - 1 && MINOR.has(lower)) return lower;
      return lower.replace(/^(['"(]*)(\p{L})/u, (_, pre: string, c: string) => pre + c.toUpperCase());
    })
    .join(' ');
}
