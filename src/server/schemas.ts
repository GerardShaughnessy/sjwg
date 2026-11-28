import { z } from 'astro/zod';
import { hasPhoneOrEmail, isEmail, isPhone, isZip } from '@/lib/validate';
import { titleCase } from '@/lib/text';
import { HttpError } from './http';
import { CONTACT_TOPIC_LABELS } from '@/config/contact-routing';

/**
 * Request bodies, validated the same way the browser validates them so the two
 * never disagree. Messages say what to fix, in the wizard's voice.
 */
const trimmed = (max: number, msg?: string) =>
  z
    .string()
    .trim()
    .max(max, msg ?? `Keep this under ${max} characters.`);

export const URGENCIES = ['can-wait', 'getting-worse', 'no-heat-or-water'] as const;

export const requestAnswersSchema = z
  .object({
    trade: trimmed(80).min(1, 'Pick the kind of help you need. "Not sure" is fine.'),
    tradeSlug: trimmed(80).default(''),
    memberId: z.union([z.string().uuid(), z.literal('')]).default(''),
    description: trimmed(4000, 'Keep the description under 4000 characters.').min(
      10,
      'Tell us a little more, even one more sentence helps.',
    ),
    urgency: z.enum(URGENCIES, { message: 'Pick how urgent it is.' }),
    zip: trimmed(10).default(''),
    neighborhood: trimmed(120).default(''),
    contact: z.object({
      name: trimmed(120).min(1, 'Tell us your name so we know who to ask for.'),
      phone: trimmed(40).default(''),
      email: trimmed(200).default(''),
      bestTime: trimmed(120).default(''),
    }),
  })
  .superRefine((v, ctx) => {
    if (!v.zip && !v.neighborhood)
      ctx.addIssue({
        code: 'custom',
        path: ['zip'],
        message: 'Give a zip code or a neighborhood so we know where you are.',
      });
    if (v.zip && !isZip(v.zip))
      ctx.addIssue({
        code: 'custom',
        path: ['zip'],
        message: 'That zip code does not look right. Five digits, like 63118.',
      });
    if (!hasPhoneOrEmail(v.contact.phone, v.contact.email)) {
      const path = v.contact.phone
        ? ['contact', 'phone']
        : v.contact.email
          ? ['contact', 'email']
          : ['contact', 'phone'];
      const message =
        !v.contact.phone && !v.contact.email
          ? 'Give a phone number or an email so someone can reach you.'
          : v.contact.phone && !isPhone(v.contact.phone)
            ? 'That phone number does not look right. Ten digits, like (314) 555-0147.'
            : 'That email does not look right, like name@example.com.';
      ctx.addIssue({ code: 'custom', path, message });
    }
  });
export type RequestAnswersInput = z.input<typeof requestAnswersSchema>;
export type RequestAnswers = z.output<typeof requestAnswersSchema>;

export const noteSchema = z.object({
  body: trimmed(2000, 'Keep the note under 2000 characters.').min(1, 'Write something first.'),
  visibleToRequester: z.boolean().default(true),
});

export const referSchema = z
  .object({
    memberId: z.string().uuid().nullable().optional(),
    note: trimmed(500).default(''),
  })
  .superRefine((v, ctx) => {
    if (!v.memberId && !v.note)
      ctx.addIssue({
        code: 'custom',
        path: ['note'],
        message: 'Pick a member, or say who you referred this to.',
      });
  });

const emailField = z
  .string()
  .trim()
  .refine((v) => isEmail(v), 'That email does not look right, like name@example.com.');

const optionalText = trimmed(4000).default('');
const phoneField = trimmed(40)
  .default('')
  .refine((v) => !v || isPhone(v), 'Ten digits with area code.');
const honeypot = z.string().max(0, 'Leave that field empty.').optional();

/** Field ids match the FieldSpec lists on the contact and get-involved pages. */
export const formSchemas = {
  contact: z.object({
    name: trimmed(120).min(1, 'Tell us your name.'),
    email: emailField,
    phone: phoneField,
    topic: z.enum(CONTACT_TOPIC_LABELS, { message: 'Pick what your message is about.' }),
    message: trimmed(4000).min(1, 'A sentence or two is enough.'),
    website: honeypot,
  }),
  partner: z.object({
    organization: trimmed(200).min(1, 'Which organization are you with?'),
    name: trimmed(120).min(1, 'Tell us your name.'),
    role: optionalText,
    email: emailField,
    phone: phoneField,
    type: optionalText,
    message: trimmed(4000).min(1, 'A sentence or two is enough.'),
    website: honeypot,
  }),
  membership: z
    .object({
      name: trimmed(120).min(1, 'Tell us your name.'),
      trade: trimmed(120).min(1, 'What trade are you in?'),
      business: optionalText,
      status: optionalText,
      phone: phoneField,
      email: trimmed(200)
        .default('')
        .refine((v) => !v || isEmail(v), 'That email is missing something, like the part after @.'),
      parish: optionalText,
      note: optionalText,
      website: honeypot,
    })
    .superRefine((v, ctx) => {
      if (!v.phone && !v.email)
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'A phone number or an email, whichever you check.',
        });
    }),
  interest: z.object({
    name: trimmed(120).min(1, 'Tell us your name.'),
    email: emailField,
    phone: phoneField,
    trade: trimmed(120).min(1, 'What trade are you in? "None yet" is fine.'),
    skills: optionalText,
    comments: optionalText,
    website: honeypot,
  }),
  rsvp: z
    .object({
      name: trimmed(120).min(1, 'Tell us your name.'),
      email: emailField,
      phone: trimmed(40)
        .default('')
        .superRefine((v, ctx) => {
          if (!isPhone(v))
            ctx.addIssue({
              code: 'custom',
              message: v
                ? 'Ten digits with area code.'
                : 'Give a phone number in case plans change.',
            });
        }),
      attending: z.enum(['yes', 'no'], { message: 'Yes or no?' }),
      adults: z.coerce.number().int().min(0).max(20).default(0),
      children: z.coerce.number().int().min(0).max(20).default(0),
      website: honeypot,
    })
    .superRefine((v, ctx) => {
      if (v.attending === 'yes' && v.adults + v.children < 1)
        ctx.addIssue({ code: 'custom', path: ['adults'], message: 'How many are coming?' });
    }),
} as const;
export type FormKind = keyof typeof formSchemas;

export const invitationSchema = z.object({
  email: emailField,
  name: trimmed(120).default(''),
  role: z.enum(['admin', 'member']).default('member'),
  memberId: z.string().uuid().nullable().optional(),
});

/** The invitee sets up his own entry: a trade (members) and an optional private phone. */
export const acceptInviteSchema = z.object({
  token: z.string().min(20),
  trade: trimmed(80).default(''),
  phone: trimmed(40).default(''),
});

/** Flatten zod issues into `{ fields, message }` for HttpError. */
export function issuesToFields(issues: z.ZodIssue[]): {
  message: string;
  fields: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join('.') || 'form';
    if (!fields[key]) fields[key] = i.message;
  }
  const first = Object.values(fields)[0] ?? 'Check the form and try again.';
  return { message: first, fields };
}

export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.output<T> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const { message, fields } = issuesToFields(r.error.issues);
  throw new HttpError(400, message, fields);
}

/* ------------------------------------------------------- portal editors */
export const profileSchema = z.object({
  name: trimmed(120).min(1, 'Your name as it should be listed.'),
  trade: trimmed(80).min(1, 'What trade are you in?'),
  areas: z.array(trimmed(80).min(1)).max(8, 'Eight areas at most.').default([]),
  yearsInTrade: z.number().int().min(0).max(80).default(0),
  availability: z.enum(['available', 'limited', 'unavailable']).default('available'),
  bio: trimmed(280, 'Keep it to one line, under 280 characters.').default(''),
  public: z.boolean().default(false),
});

export const reminderPrefsSchema = z
  .object({
    email: z.boolean().default(false),
    sms: z.boolean().default(false),
    phone: trimmed(40).default(''),
  })
  .superRefine((v, ctx) => {
    if (v.sms && !isPhone(v.phone))
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Text reminders need a ten-digit mobile number.',
      });
  });

export const postSchema = z.object({
  title: trimmed(200).min(1, 'Give the post a title first.'),
  description: trimmed(300).default(''),
  bodyMd: trimmed(50_000).default(''),
  /** Sign the post with the writer's name or as the Guild. */
  byline: z.enum(['author', 'guild']).default('author'),
});

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'That date and time do not look right.');

export const eventSchema = z
  .object({
    title: trimmed(200).min(1, 'Give the event a title.').transform(titleCase),
    kind: z
      .enum(['mass', 'holy_hour', 'meeting', 'retreat', 'procession', 'workday', 'party', 'other'])
      .default('other'),
    start: isoDate,
    end: z.union([isoDate, z.literal('')]).optional(),
    location: trimmed(200).default(''),
    summary: trimmed(300).default(''),
    body: trimmed(10_000).default(''),
    membersOnly: z.boolean().default(false),
    published: z.boolean().default(true),
    tk: trimmed(300).optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.end && Date.parse(v.end) < Date.parse(v.start))
      ctx.addIssue({ code: 'custom', path: ['end'], message: 'The end is before the start.' });
  });

export const sponsorSchema = z.object({
  name: trimmed(120).min(1, 'Give the sponsor a name.'),
  url: z
    .union([z.literal(''), z.string().trim().url('Use a full web address, starting with https://')])
    .default(''),
  tier: z.enum(['partner', 'sponsor', 'supporter', 'in-kind']).default('sponsor'),
  logoAlt: trimmed(200).default(''),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const uploadSchema = z.object({
  name: trimmed(200).default('upload'),
  dataBase64: z.string().min(1, 'Choose a file first.'),
});

export const manualDonationSchema = z.object({
  donorName: trimmed(160).min(1, 'Who gave it?'),
  donorEmail: z.union([z.literal(''), emailField]).default(''),
  amountCents: z.number().int().min(100, 'At least one dollar.').max(100_000_000),
  method: z.enum(['check', 'cash', 'ach', 'card', 'other']).default('check'),
  fund: trimmed(80).default('general'),
  tier: trimmed(40).default(''),
  recurring: z.boolean().default(false),
  receivedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date as YYYY-MM-DD.'),
  note: trimmed(500).default(''),
});

export const donationPatchSchema = z.object({
  ackStatus: z.enum(['not_required', 'pending_review', 'sent', 'manual']).optional(),
  fmvCents: z.number().int().min(0).nullable().optional(),
  note: trimmed(500).optional(),
});

/** Directory-facing contact. The tradesman and officers both edit these. */
export const publicContactFields = {
  // Optional: a save from a page opened before these fields existed leaves them alone.
  publicEmail: z.union([z.literal(''), emailField.pipe(z.string().max(200))]).optional(),
  publicPhone: phoneField.optional(),
};

export const memberAdminSchema = profileSchema.extend({
  ...publicContactFields,
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  privatePhone: trimmed(40).default(''),
  privateEmail: z.union([z.literal(''), emailField]).default(''),
});

export const announcementSchema = z.object({
  subject: trimmed(150).min(1, 'Give it a subject.'),
  body: trimmed(10_000).min(1, 'Write the message.'),
});

export const TASK_STATUSES = ['todo', 'doing', 'waiting', 'done'] as const;
export const TASK_SECTIONS = [
  'Paperwork',
  '501(c)(3)',
  'Money',
  'Site launch',
  'Content',
  'General',
] as const;

const taskFields = {
  title: trimmed(200).min(1, 'Give the task a title.'),
  notes: trimmed(10_000),
  status: z.enum(TASK_STATUSES),
  section: z.enum(TASK_SECTIONS, { message: 'Pick a section.' }),
  /** Old single-assignee field, still accepted and mapped to assigneeIds. */
  assigneeId: z.string().uuid('Pick someone from the list.').nullable(),
  assigneeIds: z
    .array(z.string().uuid('Pick people from the list.'))
    .max(20, 'Twenty people at most.'),
  waitingOn: trimmed(120),
  dueDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date as YYYY-MM-DD.')]),
  sortOrder: z.number().int().min(0).max(99_999),
};

export const taskSchema = z.object({
  ...taskFields,
  notes: taskFields.notes.default(''),
  status: taskFields.status.default('todo'),
  section: taskFields.section.default('General'),
  assigneeId: taskFields.assigneeId.default(null),
  assigneeIds: taskFields.assigneeIds.optional(),
  waitingOn: taskFields.waitingOn.default(''),
  dueDate: taskFields.dueDate.default(''),
  sortOrder: taskFields.sortOrder.default(0),
});

/**
 * Moving a card or editing part of one. No defaults, so absent fields stay
 * untouched. `addNote` appends a stamped line to the notes.
 */
export const taskPatchSchema = z
  .object({
    ...taskFields,
    // Any text here; assertTaskSection checks it against the task's current section.
    section: trimmed(80).min(1, 'Pick a section.'),
    addNote: trimmed(2000).min(1, 'Write a note first.'),
  })
  .partial();

/**
 * A task edit may keep a section that is no longer on the list (renamed or
 * retired), so the task can still be saved. Moving it to any other section
 * needs one from the list.
 */
export function assertTaskSection(next: string | undefined, current: string): void {
  if (next === undefined || next === current) return;
  if ((TASK_SECTIONS as readonly string[]).includes(next)) return;
  throw new HttpError(400, 'Pick a section.', { section: 'Pick a section.' });
}

/** The first day time can be logged on, and the most one entry can hold. */
export const TASK_TIME_FIRST_DAY = '2026-01-01';
export const TASK_TIME_MAX_MINUTES = 24 * 60;

/** Today on the Guild's clock (America/Chicago), as YYYY-MM-DD. */
export function guildToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** True for a real calendar date written YYYY-MM-DD (so 2026-02-31 is false). */
export function isCalendarDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === ymd;
}

/**
 * POST /api/tasks/[id]/time. One entry is 1 minute to 24 hours, on a real
 * date from 2026-01-01 through today in Chicago. Pass `now` to test.
 */
export const taskTimeSchemaAt = (now?: () => Date) =>
  z
    .object({
      hours: z.coerce.number().int('Whole hours.').min(0).max(24, 'Up to 24 hours at a time.'),
      minutes: z.coerce.number().int('Whole minutes.').min(0).max(59, 'Minutes from 0 to 59.'),
      workedOn: z
        .string()
        .trim()
        .refine(isCalendarDate, 'That is not a real date. Use YYYY-MM-DD.')
        .refine((d) => d >= TASK_TIME_FIRST_DAY, 'Time can be logged from January 1, 2026 on.')
        .refine((d) => d <= guildToday(now?.()), 'That day has not happened yet.'),
      note: trimmed(500).default(''),
    })
    .superRefine((t, ctx) => {
      const total = t.hours * 60 + t.minutes;
      if (total < 1)
        ctx.addIssue({ code: 'custom', path: ['minutes'], message: 'Log at least one minute.' });
      else if (total > TASK_TIME_MAX_MINUTES)
        ctx.addIssue({
          code: 'custom',
          path: ['hours'],
          message: 'One entry can be up to 24 hours. Log more days separately.',
        });
    });

export const taskTimeSchema = taskTimeSchemaAt();

/**
 * Who a task is for after this save: assigneeIds wins, the old single
 * assigneeId maps to a one-item list, and undefined means "leave as is".
 * On a PATCH, pass the task's `current` list: a lone assigneeId from an old
 * client must not wipe a multi-person list, so it only adds that person
 * (and a null leaves the list alone).
 */
export function resolveAssigneeIds(
  input: { assigneeIds?: string[]; assigneeId?: string | null },
  current?: string[],
): string[] | undefined {
  if (input.assigneeIds) return [...new Set(input.assigneeIds)];
  if (input.assigneeId === undefined) return undefined;
  if (current && current.length > 1) {
    if (!input.assigneeId || current.includes(input.assigneeId)) return undefined;
    return [...current, input.assigneeId];
  }
  return input.assigneeId ? [input.assigneeId] : [];
}

/* ------------------------------------------------------------- app users */
export const userPatchSchema = z
  .object({
    role: z.enum(['admin', 'member']),
    title: trimmed(80),
    disabled: z.boolean(),
    siteAdmin: z.boolean(),
    director: z.boolean(),
    boardTitle: trimmed(80),
    vendor: z.boolean(),
    vendorService: trimmed(120),
    /** Primary duties, one per line, merged into the officer and board agreements. */
    duties: trimmed(4000),
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'Nothing to change.');

/* -------------------------------------------------------- service hours */
export const SERVICE_HOURS_GOAL = 16;

export const serviceHoursSchema = z.object({
  /** Officers log for any member; a member's own entry is the default. */
  memberId: z.string().uuid('Pick a member.').optional(),
  workDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date as YYYY-MM-DD.')
    .refine((v) => v <= new Date(Date.now() + 36e5 * 14).toISOString().slice(0, 10), {
      message: 'That date is in the future.',
    }),
  hours: z
    .number({ message: 'How many hours?' })
    .min(0.25, 'At least a quarter hour.')
    .max(24, 'At most 24 hours in one day.')
    .refine((h) => Number.isInteger(h * 4), 'Round to the nearest quarter hour.'),
  description: trimmed(300).min(1, 'Say what the work was, for example "Parish work day".'),
});

/* ---------------------------------------------------------- email list */
export const SUBSCRIBE_SOURCES = ['popup', 'footer', 'contact', 'donate', 'site'] as const;

export const subscribeSchema = z.object({
  email: emailField.transform((v) => v.toLowerCase()),
  name: trimmed(120).optional().default(''),
  source: z.enum(SUBSCRIBE_SOURCES).catch('site'),
});
