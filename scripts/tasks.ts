/**
 * Load the launch checklist onto the officers' task board, and hand cards over
 * once someone has a login.
 *
 *   npx tsx scripts/tasks.ts seed --owner you@example.com
 *       Adds the checklist. Cards for "us" go to the owner's login; cards for
 *       Greg wait in "Waiting on someone" until he has one. Skips titles that
 *       already exist, so it is safe to rerun.
 *
 *   npx tsx scripts/tasks.ts handover --waiting-on Greg --to greg@example.com --from Gerard
 *       Assigns every card waiting on "Greg" to that login and sends him one
 *       summary email instead of one per card.
 *
 * Reads DATABASE_URL from .env (or the environment).
 */
import 'dotenv/config';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../src/server/db/client';
import * as t from '../src/server/db/schema';
import { sendEmail } from '../src/server/email/send';
import { tasksAssignedDigest } from '../src/server/email/templates/task';

const args = process.argv.slice(2);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

type Who = 'us' | 'Greg' | string;
type Seed = { title: string; section: string; who: Who; notes?: string; due?: string };

const CHECKLIST: Seed[] = [
  /* where things stand */
  {
    title: 'Working session with Greg, Monday 3:00',
    section: 'Paperwork',
    who: 'us',
    due: '2026-10-05',
    notes:
      'Go through the three Paperwork questions below with Greg, then read through the draft articles together. Leave with the legal name, the directors, and who signs.',
  },
  {
    title: 'Find out what has been filed already',
    section: 'Paperwork',
    who: 'Greg',
    notes:
      'Articles of incorporation, an EIN form (SS-4), anything sent to the IRS: what, when, by whom, and where the copies are.\n\nIf articles were ever filed, that date starts the 27-month window for a retroactive 501(c)(3).',
  },
  {
    title: 'Ask Father about the Catholic name and the Archdiocese',
    section: 'Paperwork',
    who: 'Greg',
    notes:
      'A. Permission to call ourselves a Catholic guild (canon law needs the bishop’s consent for the name).\n\nB. The Archdiocese seemed to accept and then decline. Find out exactly what was asked (listing in the Official Catholic Directory under the group ruling, or something else), why it was declined, and whether more information would change the answer.\n\nC. Will the parish take gifts for the Guild in the meantime, so they are deductible now?',
  },
  {
    title: 'Legal name, three or more directors, officers, mailing address',
    section: 'Paperwork',
    who: 'Greg',
    notes:
      'Exact name as it should appear on IRS documents. Missouri needs at least three directors. The mailing address can change later.',
  },
  {
    title: 'Check the name is available with the Missouri Secretary of State',
    section: 'Paperwork',
    who: 'us',
  },
  {
    title: 'Draft the articles of incorporation',
    section: 'Paperwork',
    who: 'us',
    notes:
      'Missouri nonprofit corporation. Include the IRS purpose clause and the dissolution clause (assets go to another 501(c)(3)); the IRS rejects applications without them. Rocket Lawyer for the form, Claude for the clauses.',
  },
  {
    title: 'File the articles with Missouri (about $25)',
    section: 'Paperwork',
    who: 'us',
    notes:
      'Online with the Secretary of State. Needs a registered agent with a Missouri street address; a director can serve.',
  },
  {
    title: 'Draft bylaws, conflict-of-interest policy, and first-meeting minutes',
    section: 'Paperwork',
    who: 'us',
  },
  {
    title: 'Board adopts the bylaws and elects officers',
    section: 'Paperwork',
    who: 'Greg',
  },
  {
    title: 'Get the EIN',
    section: 'Paperwork',
    who: 'Greg',
    notes:
      'Only after Missouri approves the articles. An EIN taken out before then is issued to an unincorporated association, and the corporation would need a new one.\n\nFree at irs.gov, weekdays, about 15 minutes. The responsible party gives his SSN.',
  },
  {
    title: 'Open the Guild bank account',
    section: 'Paperwork',
    who: 'Greg',
    notes:
      'In the Guild’s name with the EIN, not a personal account. The bank will want the articles, the EIN letter, and a board resolution naming who can sign.',
  },

  /* 501(c)(3) */
  { title: 'Decide the dues amount', section: '501(c)(3)', who: 'Greg' },
  {
    title: 'Is the $60k goal for the first year or the first six months?',
    section: '501(c)(3)',
    who: 'Greg',
  },
  {
    title: 'Confirm the giving levels and benefits are final',
    section: '501(c)(3)',
    who: 'Greg',
    notes:
      'Master $20,000, Foreman $5,000, Journeyman $1,000, Apprentice $500, Pre-apprentice $25.',
  },
  {
    title: 'Ask around for a grantor letter to speed up the IRS',
    section: '501(c)(3)',
    who: 'Greg',
    notes:
      'The IRS expedites a Form 1023 only with a letter from a donor or foundation whose grant depends on the determination by a deadline.',
  },
  {
    title: 'Write the Form 1023 narrative and the three-to-four-year budget',
    section: '501(c)(3)',
    who: 'us',
    notes:
      'Start from the pro forma and the donor decks. Frame the free repairs around a charitable class (low-income, elderly, or disabled homeowners); the member perks (job board, referrals) must read as secondary, or it looks like a trade association.',
  },
  {
    title: 'One-hour professional review of the 1023',
    section: '501(c)(3)',
    who: 'us',
  },
  { title: 'File Form 1023 on Pay.gov ($600)', section: '501(c)(3)', who: 'us' },

  /* money */
  {
    title: 'Name the Stripe account representative',
    section: 'Money',
    who: 'Greg',
    notes:
      'Stripe asks that officer for name, date of birth, home address, and the last four of his SSN.',
  },
  {
    title: 'Activate Stripe live once the EIN and bank account exist',
    section: 'Money',
    who: 'us',
  },
  {
    title: 'Accountant puts a dollar value on the giving-level benefits',
    section: 'Money',
    who: 'an accountant',
    notes: 'Receipts for levels with benefits wait on this. Or drop the benefits.',
  },
  {
    title: 'Check whether Missouri charity registration applies',
    section: 'Money',
    who: 'us',
  },
  {
    title: 'Missouri sales tax exemption, after the IRS letter',
    section: 'Money',
    who: 'us',
  },
  {
    title: 'Parish giving page, and who takes gifts in person',
    section: 'Money',
    who: 'Greg',
  },

  /* site launch */
  {
    title: 'Who answers help requests, how fast, and the service area',
    section: 'Site launch',
    who: 'Greg',
    notes:
      'The request form is live. Whoever reads requests gets an email the moment one comes in.',
  },
  {
    title: 'Public phone number and email; forward hello@sjwguild.com',
    section: 'Site launch',
    who: 'Greg',
    notes: 'Replies to hello@sjwguild.com go nowhere today.',
  },
  { title: 'List the officers who need portal logins', section: 'Site launch', who: 'Greg' },
  {
    title: 'Member roster, with each man’s consent to be listed',
    section: 'Site launch',
    who: 'Greg',
  },

  /* content */
  { title: 'Meeting time and room, and Mass times', section: 'Content', who: 'Greg' },
  {
    title: 'Consent for the testimonials and the hardship stories',
    section: 'Content',
    who: 'Greg',
  },
  { title: 'Real events for the next few months', section: 'Content', who: 'Greg' },
  {
    title: 'Volunteer roles, blog writers, social media links',
    section: 'Content',
    who: 'Greg',
  },
  { title: 'Photos, headshots, and the promo video', section: 'Content', who: 'Greg' },
  { title: 'Put the new logos on the site', section: 'Content', who: 'us' },
  {
    title: 'Update CONTENT-TODO.md: Stripe, build hook, and webhook notes are stale',
    section: 'General',
    who: 'us',
  },
];

async function userByEmail(email: string) {
  const [u] = await db()
    .select()
    .from(t.appUsers)
    .where(sql`lower(${t.appUsers.email}) = ${email.toLowerCase()}`)
    .limit(1);
  if (!u) throw new Error(`No portal login for ${email}.`);
  if (u.role !== 'admin') throw new Error(`${email} is not an officer.`);
  return u;
}

async function seed() {
  const owner = await userByEmail(opt('--owner') ?? '');
  const existing = new Set(
    (await db().select({ title: t.tasks.title }).from(t.tasks)).map((r) => r.title),
  );
  let added = 0;
  for (const [i, s] of CHECKLIST.entries()) {
    if (existing.has(s.title)) continue;
    const ours = s.who === 'us';
    await db()
      .insert(t.tasks)
      .values({
        title: s.title,
        notes: s.notes ?? '',
        section: s.section,
        status: ours ? 'todo' : 'waiting',
        assigneeId: ours ? owner.id : null,
        waitingOn: ours ? '' : s.who,
        dueDate: s.due ?? null,
        sortOrder: (i + 1) * 10,
        createdBy: owner.id,
      });
    added++;
  }
  console.log(`Added ${added} tasks (${CHECKLIST.length - added} already there).`);
}

async function handover() {
  const waitingOn = opt('--waiting-on') ?? '';
  const to = await userByEmail(opt('--to') ?? '');
  const from = opt('--from') ?? 'A Guild officer';
  const rows = await db()
    .update(t.tasks)
    .set({ assigneeId: to.id, waitingOn: '', updatedAt: new Date() })
    .where(and(eq(t.tasks.waitingOn, waitingOn), sql`${t.tasks.status} <> 'done'`))
    .returning({ title: t.tasks.title, sortOrder: t.tasks.sortOrder });
  console.log(`Assigned ${rows.length} tasks to ${to.email}.`);
  if (!rows.length) return;
  const res = await sendEmail({
    to: to.email,
    email: tasksAssignedDigest({
      titles: rows.sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.title),
      assignedBy: from,
      name: to.name?.split(' ')[0] ?? '',
    }),
    template: 'tasks_digest',
    related: { type: 'user', id: to.id },
  });
  console.log(`Summary email: ${res.status}${'error' in res ? ` (${res.error})` : ''}`);
}

const cmd = args[0];
(cmd === 'seed'
  ? seed()
  : cmd === 'handover'
    ? handover()
    : Promise.reject(new Error('Use seed or handover.'))
)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
