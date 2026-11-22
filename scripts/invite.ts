/**
 * Send a portal invitation from the command line, the same email the
 * Invitations tab sends. Useful before anyone can log in to send it.
 *
 *   npx tsx scripts/invite.ts --email greg@example.com --name "Greg Miller" --role admin --from you@example.com
 *
 * --from is the inviting officer's login; his name goes in the email.
 * Reads DATABASE_URL, PUBLIC_SITE_URL, RESEND_API_KEY, and EMAIL_FROM from .env or the environment.
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { toAppSession } from '../src/server/auth/session';
import { db } from '../src/server/db/client';
import { appUsers } from '../src/server/db/schema';
import { invite } from '../src/server/db/queries/invitations';

const args = process.argv.slice(2);
const opt = (f: string) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const email = opt('--email');
  const fromEmail = opt('--from');
  if (!email || !fromEmail) throw new Error('Pass --email and --from.');
  const [by] = await db()
    .select()
    .from(appUsers)
    .where(sql`lower(${appUsers.email}) = ${fromEmail.toLowerCase()}`)
    .limit(1);
  if (!by || by.role !== 'admin') throw new Error(`${fromEmail} is not an officer.`);
  const session = toAppSession(by, {});
  if (!session) throw new Error(`${fromEmail} is disabled.`);
  const role = opt('--role') === 'admin' ? 'admin' : 'member';
  // Same rule as the portal: only the Admin invites an officer.
  if (role === 'admin' && !session.siteAdmin)
    throw new Error(`${fromEmail} is not the Admin, so cannot invite an officer.`);
  const r = await invite({ email, name: opt('--name') ?? '', role }, session);
  console.log(
    `Invitation for ${r.row.email} (${r.row.role}): ${r.emailed ? 'emailed' : `NOT emailed (${r.mailError})`}`,
  );
  console.log(`Link (works once, 7 days): ${process.env.PUBLIC_SITE_URL}/invite/${r.token}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
