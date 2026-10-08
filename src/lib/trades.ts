/** Trade and area helpers. The directory's trade filter lists the trades members actually have. */
export const NOT_SURE = 'Not sure';

/** The trades officers pick from in the portal. "Other" lets them type one in. */
export const COMMON_TRADES = [
  'Appliance Repair',
  'Auto Mechanic',
  'Cabinetry',
  'Carpentry',
  'Concrete',
  'Drywall',
  'Electrical',
  'Excavation',
  'Fencing',
  'Flooring',
  'Garage Doors',
  'General Contracting',
  'General Repair',
  'Glass and Glazing',
  'Gutters',
  'Handyman',
  'HVAC',
  'Insulation',
  'Ironwork',
  'Landscaping',
  'Locksmith',
  'Masonry',
  'Painting',
  'Pest Control',
  'Plastering',
  'Plumbing',
  'Roofing',
  'Siding',
  'Tile',
  'Tree Service',
  'Welding',
  'Windows and Doors',
] as const;

export const OTHER_TRADE = 'Other';

/** Directory order: by trade, then by name. */
export function byTradeThenName<T extends { trade: string; name: string }>(a: T, b: T): number {
  return a.trade.localeCompare(b.trade) || a.name.localeCompare(b.name);
}

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
