import { describe, expect, it } from 'vitest';
import { aidApplicationSchema, aidDecisionSchema } from './aid';
import { answerRows, dollarsToCents, EMPTY_AID, pickAnswers, type AidAnswers } from '@/lib/aid';

const base: AidAnswers = {
  ...EMPTY_AID,
  contactName: 'Mary Smith',
  email: 'mary@example.com',
  phone: '314-555-0100',
  address: '123 Main St, St. Louis 63104',
  need: 'The furnace failed and we cannot afford to replace it.',
  urgency: 'weeks',
  affirmTruth: true,
};

function errorsOf(input: Partial<AidAnswers>): Record<string, string> {
  const r = aidApplicationSchema.safeParse(input);
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const i of r.error.issues) out[i.path.join('.')] ??= i.message;
  return out;
}

const family: AidAnswers = {
  ...base,
  applicantType: 'family',
  parish: 'St. Mary of Victories',
  householdSize: '5',
  faithImpact: 'The stress is straining our marriage.',
};
const tradesman: AidAnswers = {
  ...family,
  applicantType: 'tradesman-medical',
  trade: 'Electrician',
  medicalNature: 'A heart attack in September.',
  insurance: 'High deductible, mostly used up.',
};
const school: AidAnswers = {
  ...base,
  applicantType: 'school',
  orgName: 'St. Agnes School',
  schoolFormation: 'Daily Mass and catechesis.',
  teachersCatholic: 'yes',
  studentImpact: 'The chapel would close.',
};
const parish: AidAnswers = {
  ...base,
  applicantType: 'parish',
  orgName: 'St. Anthony',
  community: 'A small urban parish with a food pantry.',
  diocese: 'Archdiocese of St. Louis',
};
const business: AidAnswers = {
  ...base,
  applicantType: 'business',
  orgName: 'Catholic Books LLC',
  mission: 'We sell Catholic books and support local parishes.',
  catastrophicImpact: 'A fire closed the store and we cannot pay the mortgage.',
  forProfit: 'yes',
  attestValues: true,
};

describe('aidApplicationSchema', () => {
  it('accepts a complete application of every type', () => {
    for (const a of [
      family,
      tradesman,
      school,
      parish,
      { ...parish, applicantType: 'religious-house' as const },
      business,
      { ...business, applicantType: 'organization' as const },
    ])
      expect(errorsOf(a), a.applicantType).toEqual({});
  });

  it('requires who is asking', () => {
    expect(errorsOf({ ...base, applicantType: '' })).toHaveProperty('applicantType');
    expect(errorsOf({ ...base, applicantType: 'robot' as never })).toHaveProperty('applicantType');
  });

  it('requires contact details, the need, urgency, and the truthfulness affirmation', () => {
    const e = errorsOf({ applicantType: 'family' });
    for (const f of ['contactName', 'email', 'phone', 'address', 'need', 'urgency', 'affirmTruth'])
      expect(e, f).toHaveProperty(f);
    expect(errorsOf({ ...family, email: 'nope' })).toHaveProperty('email');
    expect(errorsOf({ ...family, phone: '555' })).toHaveProperty('phone');
    expect(errorsOf({ ...family, affirmTruth: false })).toHaveProperty('affirmTruth');
  });

  it('requires faith impact, household size, and parish for families and tradesmen', () => {
    for (const a of [family, tradesman]) {
      expect(errorsOf({ ...a, faithImpact: '' })).toHaveProperty('faithImpact');
      expect(errorsOf({ ...a, householdSize: '' })).toHaveProperty('householdSize');
      expect(errorsOf({ ...a, householdSize: 'lots' })).toHaveProperty('householdSize');
      expect(errorsOf({ ...a, parish: '' })).toHaveProperty('parish');
    }
  });

  it('requires trade, medical emergency, and insurance for a tradesman', () => {
    const e = errorsOf({ ...family, applicantType: 'tradesman-medical' });
    expect(Object.keys(e).sort()).toEqual(['insurance', 'medicalNature', 'trade']);
    expect(errorsOf({ ...tradesman, monthlyShortfall: '' })).toEqual({});
  });

  it('requires an organization name for organization types, parish optional', () => {
    for (const a of [school, parish, business]) {
      expect(errorsOf({ ...a, orgName: '' })).toHaveProperty('orgName');
      expect(errorsOf({ ...a, parish: '' })).toEqual({});
    }
    expect(errorsOf({ ...family, orgName: '' })).toEqual({});
  });

  it('asks a school about formation, teachers, and students', () => {
    const e = errorsOf({ ...base, applicantType: 'school', orgName: 'St. Agnes' });
    expect(Object.keys(e).sort()).toEqual(['schoolFormation', 'studentImpact', 'teachersCatholic']);
    expect(errorsOf({ ...school, teachersCatholic: 'no' })).toHaveProperty('teachersExplain');
    expect(errorsOf({ ...school, teachersCatholic: 'explain' })).toHaveProperty('teachersExplain');
    expect(
      errorsOf({ ...school, teachersCatholic: 'no', teachersExplain: 'Two are not.' }),
    ).toEqual({});
  });

  it('asks parishes and religious houses for the community and diocese', () => {
    for (const t of ['parish', 'religious-house'] as const) {
      const e = errorsOf({ ...base, applicantType: t, orgName: 'X' });
      expect(Object.keys(e).sort()).toEqual(['community', 'diocese']);
    }
  });

  it('requires mission and the attestation for businesses and other organizations', () => {
    for (const t of ['business', 'organization'] as const) {
      expect(errorsOf({ ...business, applicantType: t, attestValues: false })).toHaveProperty(
        'attestValues',
      );
      expect(errorsOf({ ...business, applicantType: t, mission: '' })).toHaveProperty('mission');
    }
  });

  it('does not ask organizations the family questions', () => {
    expect(errorsOf({ ...business, faithImpact: '', householdSize: '' })).toEqual({});
  });

  it('rejects unknown help kinds and very long answers', () => {
    expect(errorsOf({ ...family, helpKinds: ['gold' as never] })).toHaveProperty('helpKinds.0');
    expect(errorsOf({ ...family, need: 'x'.repeat(4001) })).toHaveProperty('need');
  });
});

describe('pickAnswers and answerRows', () => {
  it('keeps only the questions this applicant was asked', () => {
    const picked = pickAnswers({ ...business, faithImpact: 'stray', trade: 'stray' });
    expect(picked).not.toHaveProperty('faithImpact');
    expect(picked).not.toHaveProperty('trade');
    expect(picked).toHaveProperty('mission');
    expect(pickAnswers({ ...school, teachersExplain: 'stray' }).teachersExplain).toBe('');
  });
  it('labels answers for people to read', () => {
    const rows = answerRows(pickAnswers({ ...tradesman, helpKinds: ['materials', 'relief'] }));
    const get = (l: string) => rows.find((r) => r.label === l)?.value;
    expect(get('Who is asking')).toMatch(/tradesman/);
    expect(get('How urgent')).toBe('Within a few weeks');
    expect(get('Help that would make the difference')).toBe(
      'Paying for materials, Financial relief toward bills',
    );
    expect(get('Estimated cost')).toBe('Not given');
  });
});

describe('aidDecisionSchema', () => {
  it('stores the award in cents', () => {
    expect(aidDecisionSchema.parse({ status: 'approved', award: '$1,250.50' }).awardCents).toBe(
      125050,
    );
    expect(aidDecisionSchema.parse({ status: 'reviewing', award: '' }).awardCents).toBeNull();
  });
  it('rejects amounts that are not money, and unknown statuses', () => {
    expect(aidDecisionSchema.safeParse({ status: 'approved', award: 'ten' }).success).toBe(false);
    expect(aidDecisionSchema.safeParse({ status: 'maybe', award: '' }).success).toBe(false);
  });
  it('parses dollars', () => {
    expect(dollarsToCents('1500')).toBe(150000);
    expect(dollarsToCents('12.345')).toBeNaN();
  });
});

describe('for-profit applicants', () => {
  const base = {
    contactName: 'Pat',
    email: 'pat@example.com',
    phone: '(314) 555-0147',
    contactPref: 'Phone call',
    address: 'St. Louis 63104',
    orgName: 'Pat Plumbing LLC',
    need: 'Flood ruined the shop.',
    urgency: 'weeks',
    mission: 'Family plumbing business run by Catholics.',
    attestValues: true,
    affirmTruth: true,
  };
  it('a business must explain why the crisis is catastrophic', () => {
    const r = aidApplicationSchema.safeParse({ ...base, applicantType: 'business' });
    expect(r.success).toBe(false);
    expect(
      aidApplicationSchema.safeParse({
        ...base,
        applicantType: 'business',
        catastrophicImpact: 'We would lose the house.',
      }).success,
    ).toBe(true);
  });
  it('another organization says whether it is for-profit', () => {
    expect(aidApplicationSchema.safeParse({ ...base, applicantType: 'organization' }).success).toBe(
      false,
    );
    expect(
      aidApplicationSchema.safeParse({ ...base, applicantType: 'organization', forProfit: 'no' })
        .success,
    ).toBe(true);
    expect(
      aidApplicationSchema.safeParse({ ...base, applicantType: 'organization', forProfit: 'yes' })
        .success,
    ).toBe(false);
  });
});
