/** Print the Christmas party RSVP list and head count: npx tsx scripts/rsvp-report.ts */
import 'dotenv/config';
import { christmasRsvps, headCount, CHRISTMAS } from '../src/server/rsvp/christmas';

const rows = await christmasRsvps();
const yes = rows.filter((r) => r.attending === 'yes');
const no = rows.filter((r) => r.attending === 'no');
console.log(`Christmas party: ${headCount(rows)} of ${CHRISTMAS.capacity} coming (${yes.length} RSVPs yes, ${no.length} no)\n`);
for (const r of yes) console.log(`YES  ${r.name.padEnd(28)} ${String(r.adults).padStart(2)} adults ${String(r.children).padStart(2)} children  ${r.email}  ${r.phone}`);
for (const r of no) console.log(`no   ${r.name.padEnd(28)} ${r.email}`);
process.exit(0);
