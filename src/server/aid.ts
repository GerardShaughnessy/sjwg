import { z } from 'astro/zod';
import {
  AID_STATUSES,
  aidErrors,
  APPLICANT_TYPE_VALUES,
  dollarsToCents,
  HELP_KIND_VALUES,
  URGENCY_VALUES,
  type AidAnswers,
} from '@/lib/aid';

/**
 * Server-side checks for the Request Help application. The shape is checked
 * here; what each kind of applicant must answer comes from aidErrors in
 * src/lib/aid.ts, which the browser runs too.
 */
const short = (max = 200) =>
  z.string().trim().max(max, `Keep this under ${max} characters.`).default('');
const long = short(4000);

const choice = <T extends [string, ...string[]]>(values: T) =>
  z.union([z.enum(values), z.literal('')]).default('');

export const aidApplicationSchema = z
  .object({
    applicantType: choice(APPLICANT_TYPE_VALUES),
    contactName: short(120),
    email: short(200),
    phone: short(40),
    contactPref: short(40),
    address: short(300),
    parish: short(200),
    orgName: short(200),
    need: long,
    urgency: choice(URGENCY_VALUES),
    helpKinds: z.array(z.enum(HELP_KIND_VALUES)).max(4).default([]),
    estimatedCost: short(100),
    otherHelp: long,
    householdSize: short(10),
    faithImpact: long,
    trade: short(120),
    medicalNature: long,
    insurance: long,
    monthlyShortfall: short(100),
    schoolFormation: long,
    teachersCatholic: z.union([z.enum(['yes', 'no', 'explain']), z.literal('')]).default(''),
    teachersExplain: long,
    studentImpact: long,
    community: long,
    diocese: short(200),
    mission: long,
    attestValues: z.boolean().default(false),
    affirmTruth: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    for (const [path, message] of Object.entries(aidErrors(v as AidAnswers)))
      ctx.addIssue({ code: 'custom', path: [path], message });
  });

export type AidApplicationInput = z.output<typeof aidApplicationSchema>;

export const aidDecisionSchema = z
  .object({
    status: z.enum(AID_STATUSES),
    award: z.string().trim().max(20).default(''),
    decisionNote: z.string().trim().max(4000, 'Keep the note under 4000 characters.').default(''),
  })
  .transform((v, ctx) => {
    const awardCents = dollarsToCents(v.award);
    if (Number.isNaN(awardCents)) {
      ctx.addIssue({ code: 'custom', path: ['award'], message: 'A dollar amount, like 1500.' });
      return z.NEVER;
    }
    if (awardCents != null && awardCents > 100_000_000) {
      ctx.addIssue({ code: 'custom', path: ['award'], message: 'That amount looks too large.' });
      return z.NEVER;
    }
    return { status: v.status, awardCents, decisionNote: v.decisionNote };
  });
