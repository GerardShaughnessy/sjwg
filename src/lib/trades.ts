/** Trade and area helpers. members.json is the only source of trade names. */
export const NOT_SURE = 'Not sure';

type HasTrade = { trade: string; areas: string[] };

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getTrades(members: HasTrade[]): string[] {
  return [...new Set(members.map((m) => m.trade))].sort((a, b) => a.localeCompare(b));
}

export function getAreas(members: HasTrade[]): string[] {
  return [...new Set(members.flatMap((m) => m.areas))].sort((a, b) => a.localeCompare(b));
}

/** Resolve a query-string slug to a known trade. Unknown slugs return null. */
export function tradeFromSlug(trades: string[], slug: string | null | undefined): string | null {
  if (!slug) return null;
  if (slug === slugify(NOT_SURE)) return NOT_SURE;
  return trades.find((t) => slugify(t) === slug) ?? null;
}
