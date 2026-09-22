import { GIVING_LEVELS } from '@/config/site';

/**
 * IRS substantiation rules, reduced to the cases the Guild meets:
 * - A gift with no goods or services in return gets a full receipt saying so.
 * - A gift at a level with benefits is a quid pro quo contribution. For gifts
 *   over $75 the receipt must state the fair market value (FMV) of the benefits
 *   and that only the excess is deductible. Until an accountant sets the FMV,
 *   we send a plain thank-you and hold the formal receipt for review.
 */
export interface TierFmv {
  key: string;
  name: string;
  benefits: readonly string[];
  fmvCents: number | null;
}

export type ReceiptDecision =
  | { kind: 'full'; deductibleCents: number; fmvCents: 0; benefits: [] }
  | { kind: 'full'; deductibleCents: number; fmvCents: number; benefits: readonly string[] }
  | { kind: 'pending_review'; reason: string; benefits: readonly string[] };

export const QUID_PRO_QUO_THRESHOLD_CENTS = 7_500;

/** Map a Checkout amount to the highest giving level it reaches, unless a tier was chosen. */
export function tierForAmount(amountCents: number): (typeof GIVING_LEVELS)[number] | null {
  return (
    [...GIVING_LEVELS]
      .sort((a, b) => b.minCents - a.minCents)
      .find((g) => amountCents >= g.minCents) ?? null
  );
}

export function decideReceipt(amountCents: number, tier: TierFmv | null): ReceiptDecision {
  if (!tier || tier.benefits.length === 0) {
    return { kind: 'full', deductibleCents: amountCents, fmvCents: 0, benefits: [] };
  }
  if (tier.fmvCents === null) {
    return {
      kind: 'pending_review',
      reason: `The ${tier.name} level includes benefits whose fair market value has not been set.`,
      benefits: tier.benefits,
    };
  }
  // Token benefits (insubstantial value) still get a full receipt; the FMV line covers it either way.
  const deductible = Math.max(0, amountCents - tier.fmvCents);
  return {
    kind: 'full',
    deductibleCents: deductible,
    fmvCents: tier.fmvCents,
    benefits: tier.benefits,
  };
}

export const dollars = (cents: number) =>
  (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
