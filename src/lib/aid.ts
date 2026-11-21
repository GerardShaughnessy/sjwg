/**
 * The Request Help (charity aid) application: who can ask, the questions each
 * kind of applicant answers, readable labels, and one validator the browser
 * and the server both use so they never disagree. No server imports here.
 */
import { isEmail, isPhone } from './validate';

export const APPLICANT_TYPES = [
  { value: 'family', label: 'An individual or family' },
  {
    value: 'tradesman-medical',
    label: 'A tradesman or tradeswoman, or their family, facing a medical emergency',
  },
  { value: 'parish', label: 'A parish or church' },
  { value: 'school', label: 'A Catholic school' },
  { value: 'religious-house', label: 'A shrine, convent, or monastery' },
  { value: 'business', label: 'A Catholic business' },
  { value: 'organization', label: 'Another organization' },
] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number]['value'];
export const APPLICANT_TYPE_VALUES = APPLICANT_TYPES.map((t) => t.value) as [
  ApplicantType,
  ...ApplicantType[],
];
export const APPLICANT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  APPLICANT_TYPES.map((t) => [t.value, t.label]),
);

export const PERSONAL_TYPES: readonly ApplicantType[] = ['family', 'tradesman-medical'];
export const ORG_TYPES: readonly ApplicantType[] = [
  'parish',
  'school',
  'religious-house',
  'business',
  'organization',
];
export const isOrgType = (t: string) => (ORG_TYPES as readonly string[]).includes(t);

/** What the organization-name field is called for each kind of applicant. */
export const ORG_NAME_LABEL: Record<string, string> = {
  parish: 'Name of the parish or church',
  school: 'Name of the school',
  'religious-house': 'Name of the shrine, convent, or monastery',
  business: 'Name of the business',
  organization: 'Name of the organization',
};

export const URGENCY_OPTIONS = [
  { value: 'emergency', label: 'An emergency, days matter' },
  { value: 'weeks', label: 'Within a few weeks' },
  { value: 'months', label: 'Within a few months' },
  { value: 'flexible', label: 'Flexible' },
] as const;
export type AidUrgency = (typeof URGENCY_OPTIONS)[number]['value'];
export const URGENCY_VALUES = URGENCY_OPTIONS.map((o) => o.value) as [AidUrgency, ...AidUrgency[]];
export const AID_URGENCY_LABEL: Record<string, string> = Object.fromEntries(
  URGENCY_OPTIONS.map((o) => [o.value, o.label]),
);

export const HELP_KIND_OPTIONS = [
  { value: 'materials', label: 'Paying for materials' },
  { value: 'labor', label: "Paying for a tradesman's time" },
  { value: 'relief', label: 'Financial relief toward bills' },
  { value: 'unsure', label: 'Not sure' },
] as const;
export type HelpKind = (typeof HELP_KIND_OPTIONS)[number]['value'];
export const HELP_KIND_VALUES = HELP_KIND_OPTIONS.map((o) => o.value) as [HelpKind, ...HelpKind[]];

export const CONTACT_PREF_OPTIONS = ['Phone call', 'Text message', 'Email'] as const;

export const TEACHERS_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'explain', label: 'It is more complicated. Let me explain.' },
] as const;

export const AID_STATUSES = ['new', 'reviewing', 'approved', 'declined', 'closed'] as const;
export type AidStatus = (typeof AID_STATUSES)[number];
export const AID_STATUS_LABEL: Record<AidStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  approved: 'Approved',
  declined: 'Declined',
  closed: 'Closed',
};

export const AID_MAX_FILES = 5;
export const AID_FILE_MAX_BYTES = 4 * 1024 * 1024;
/**
 * Netlify functions take at most 6 MB per request, so the browser keeps the
 * whole upload under this. Photos are shrunk before sending, so most fit.
 */
export const AID_TOTAL_MAX_BYTES = 4 * 1024 * 1024;

/** Everything the form can send. Strings are trimmed; unused ones are blank. */
export interface AidAnswers {
  applicantType: ApplicantType | '';
  contactName: string;
  email: string;
  phone: string;
  contactPref: string;
  address: string;
  parish: string;
  orgName: string;
  need: string;
  urgency: AidUrgency | '';
  helpKinds: HelpKind[];
  estimatedCost: string;
  otherHelp: string;
  // individual / family and tradesman
  householdSize: string;
  faithImpact: string;
  // tradesman medical
  trade: string;
  medicalNature: string;
  insurance: string;
  monthlyShortfall: string;
  // school
  schoolFormation: string;
  teachersCatholic: string;
  teachersExplain: string;
  studentImpact: string;
  // parish, shrine, convent, monastery
  community: string;
  diocese: string;
  // business and other organization
  mission: string;
  attestValues: boolean;
  /** Other organizations: 'yes' if it is a for-profit business. */
  forProfit: string;
  /** For-profit applicants: why the crisis is catastrophic for faith life or household. */
  catastrophicImpact: string;
  // everyone
  affirmTruth: boolean;
}

export const EMPTY_AID: AidAnswers = {
  applicantType: '',
  contactName: '',
  email: '',
  phone: '',
  contactPref: '',
  address: '',
  parish: '',
  orgName: '',
  need: '',
  urgency: '',
  helpKinds: [],
  estimatedCost: '',
  otherHelp: '',
  householdSize: '',
  faithImpact: '',
  trade: '',
  medicalNature: '',
  insurance: '',
  monthlyShortfall: '',
  schoolFormation: '',
  teachersCatholic: '',
  teachersExplain: '',
  studentImpact: '',
  community: '',
  diocese: '',
  mission: '',
  attestValues: false,
  forProfit: '',
  catastrophicImpact: '',
  affirmTruth: false,
};

/** A business, or another organization that says it is for-profit. */
export function isForProfit(a: Pick<AidAnswers, 'applicantType' | 'forProfit'>): boolean {
  return (
    a.applicantType === 'business' || (a.applicantType === 'organization' && a.forProfit === 'yes')
  );
}

/** Fields that belong to one kind of applicant only. Others are dropped on save. */
const TYPE_FIELDS: Record<ApplicantType, (keyof AidAnswers)[]> = {
  family: ['householdSize', 'faithImpact'],
  'tradesman-medical': [
    'householdSize',
    'faithImpact',
    'trade',
    'medicalNature',
    'insurance',
    'monthlyShortfall',
  ],
  parish: ['community', 'diocese'],
  school: ['schoolFormation', 'teachersCatholic', 'teachersExplain', 'studentImpact'],
  'religious-house': ['community', 'diocese'],
  business: ['mission', 'attestValues', 'catastrophicImpact'],
  organization: ['mission', 'attestValues', 'forProfit', 'catastrophicImpact'],
};

const COMMON_FIELDS: (keyof AidAnswers)[] = [
  'applicantType',
  'contactName',
  'email',
  'phone',
  'contactPref',
  'address',
  'parish',
  'orgName',
  'need',
  'urgency',
  'helpKinds',
  'estimatedCost',
  'otherHelp',
  'affirmTruth',
];

/** The fields this applicant answers, in the order the form shows them. */
export function fieldsFor(type: string): (keyof AidAnswers)[] {
  const extra = TYPE_FIELDS[type as ApplicantType] ?? [];
  const common = COMMON_FIELDS.filter((f) => {
    if (f === 'orgName') return isOrgType(type);
    if (f === 'parish') return type !== 'parish';
    return true;
  });
  // Type-specific questions sit after the contact block, before the need.
  const at = common.indexOf('need');
  return [...common.slice(0, at), ...extra, ...common.slice(at)];
}

/** Keep only the answers this kind of applicant was asked. */
export function pickAnswers(a: AidAnswers): Partial<AidAnswers> {
  const out: Record<string, unknown> = {};
  for (const f of fieldsFor(a.applicantType)) out[f] = a[f];
  if (a.applicantType === 'school' && a.teachersCatholic === 'yes') out.teachersExplain = '';
  return out as Partial<AidAnswers>;
}

export const FAITH_IMPACT_LABEL =
  "How might this crisis affect your or your family's faith life, marriage, or your children's spiritual formation?";

export const AID_FIELD_LABEL: Record<keyof AidAnswers, string> = {
  applicantType: 'Who is asking',
  contactName: 'Contact name',
  email: 'Email',
  phone: 'Phone',
  contactPref: 'Best way to reach them',
  address: 'Street address or area',
  parish: 'Parish',
  orgName: 'Organization',
  need: 'The need',
  urgency: 'How urgent',
  helpKinds: 'Help that would make the difference',
  estimatedCost: 'Estimated cost',
  otherHelp: 'Others asked for help',
  householdSize: 'Household size',
  faithImpact: 'Effect on faith life, marriage, or children',
  trade: 'Trade',
  medicalNature: 'The medical emergency',
  insurance: 'Health insurance',
  monthlyShortfall: 'Expected monthly shortfall',
  schoolFormation: 'How the school furthers Catholic formation',
  teachersCatholic: 'All teachers practising Catholics in good standing',
  teachersExplain: 'About the teachers',
  studentImpact: "Effect on students' spiritual formation if unmet",
  community: 'Community or ministry',
  diocese: 'Diocese',
  mission: 'Mission and shared values',
  attestValues: 'Attests nothing conflicts with Church teaching',
  forProfit: 'For-profit business',
  catastrophicImpact: 'Why the crisis is catastrophic (faith life or stable household)',
  affirmTruth: 'Affirmed everything is true',
};

/** Readable label/value pairs for the officer email and the admin panel. */
export function answerRows(answers: Partial<AidAnswers>): { label: string; value: string }[] {
  const type = answers.applicantType ?? '';
  const rows: { label: string; value: string }[] = [];
  for (const f of fieldsFor(type)) {
    const v = answers[f];
    let value: string;
    if (f === 'applicantType') value = APPLICANT_TYPE_LABEL[String(v)] ?? String(v ?? '');
    else if (f === 'urgency') value = AID_URGENCY_LABEL[String(v)] ?? String(v ?? '');
    else if (f === 'helpKinds')
      value = (Array.isArray(v) ? v : [])
        .map((k) => HELP_KIND_OPTIONS.find((o) => o.value === k)?.label ?? String(k))
        .join(', ');
    else if (f === 'teachersCatholic')
      value = TEACHERS_OPTIONS.find((o) => o.value === v)?.label ?? String(v ?? '');
    else if (typeof v === 'boolean') value = v ? 'Yes' : 'No';
    else value = String(v ?? '');
    if (f === 'orgName' && ORG_NAME_LABEL[type]) {
      rows.push({ label: ORG_NAME_LABEL[type].replace(/^Name of the /, 'The '), value });
      continue;
    }
    rows.push({ label: AID_FIELD_LABEL[f], value: value.trim() || 'Not given' });
  }
  return rows;
}

const blank = (v: string) => !v || !v.trim();

/**
 * Field id to message for everything that needs fixing. Empty means valid.
 * Messages say what to fix, in plain words.
 */
export function aidErrors(a: AidAnswers): Record<string, string> {
  const e: Record<string, string> = {};
  const type = a.applicantType;
  if (!type || !(APPLICANT_TYPE_VALUES as string[]).includes(type)) {
    e.applicantType = 'Choose who is asking for help.';
    return e;
  }
  if (blank(a.contactName)) e.contactName = 'Who should we talk to?';
  if (blank(a.email)) e.email = 'We need an email to send your confirmation.';
  else if (!isEmail(a.email)) e.email = 'That email does not look right, like name@example.com.';
  if (blank(a.phone)) e.phone = 'A phone number, so an officer can call.';
  else if (!isPhone(a.phone)) e.phone = 'Ten digits with area code.';
  if (blank(a.address)) e.address = 'A street address, or at least the city and ZIP.';
  if (PERSONAL_TYPES.includes(type) && blank(a.parish))
    e.parish = 'Which parish do you belong to? If none, say so.';
  if (isOrgType(type) && blank(a.orgName)) e.orgName = 'The name of the organization.';

  if (PERSONAL_TYPES.includes(type)) {
    if (blank(a.householdSize)) e.householdSize = 'How many people live in the household?';
    else if (!/^\d{1,2}$/.test(a.householdSize.trim()) || Number(a.householdSize) < 1)
      e.householdSize = 'A number, like 4.';
    if (blank(a.faithImpact)) e.faithImpact = 'Please answer this. A few sentences is enough.';
  }
  if (type === 'tradesman-medical') {
    if (blank(a.trade)) e.trade = 'What is the trade?';
    if (blank(a.medicalNature)) e.medicalNature = 'Tell us briefly what happened.';
    if (blank(a.insurance))
      e.insurance = 'Tell us about the health insurance situation, or that there is none.';
  }
  if (type === 'school') {
    if (blank(a.schoolFormation)) e.schoolFormation = 'Tell us how the school forms its students.';
    if (!['yes', 'no', 'explain'].includes(a.teachersCatholic))
      e.teachersCatholic = 'Choose an answer.';
    else if (a.teachersCatholic !== 'yes' && blank(a.teachersExplain))
      e.teachersExplain = 'Tell us a little more.';
    if (blank(a.studentImpact)) e.studentImpact = 'Tell us how your students would be affected.';
  }
  if (type === 'parish' || type === 'religious-house') {
    if (blank(a.community)) e.community = 'Tell us about the community or ministry.';
    if (blank(a.diocese)) e.diocese = 'Which diocese?';
  }
  if (type === 'business' || type === 'organization') {
    if (blank(a.mission)) e.mission = 'Tell us the mission and how it shares the Guild’s values.';
    if (!a.attestValues) e.attestValues = 'Check this box to apply.';
    if (type === 'organization' && !['yes', 'no'].includes(a.forProfit))
      e.forProfit = 'Choose an answer.';
    if (isForProfit(a) && blank(a.catastrophicImpact))
      e.catastrophicImpact =
        'Please explain. The Guild helps a business only in a catastrophic case.';
  }

  if (blank(a.need)) e.need = 'Describe the need. A few sentences is enough.';
  if (!a.urgency || !(URGENCY_VALUES as string[]).includes(a.urgency))
    e.urgency = 'Choose how urgent it is.';
  if (!a.affirmTruth) e.affirmTruth = 'Check this box to send your request.';
  return e;
}

/** "$1,250.50" or "1250" to cents. Blank is null. Returns NaN when it is not money. */
export function dollarsToCents(input: string): number | null {
  const s = input.replace(/[$,\s]/g, '');
  if (!s) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

export const centsToDollars = (cents: number | null | undefined) =>
  cents == null ? '' : (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
