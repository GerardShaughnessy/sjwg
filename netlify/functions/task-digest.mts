import type { Config } from '@netlify/functions';
import { sendTaskDigests } from '../../src/server/tasks';

/**
 * Every 5 minutes. Sends the batched "new task" emails: one per person whose
 * oldest pending assignment is at least 15 minutes old, listing every task
 * they were put on since. Rows are claimed before sending, so overlapping
 * runs never send a task twice.
 */
export default async () => {
  const r = await sendTaskDigests(new Date());
  const summary = `[task-digest] ${r.people} ready, ${r.sent} sent, ${r.failed} failed, ${r.discarded} skipped`;
  console.log(summary);
  return new Response(summary);
};

export const config: Config = { schedule: '*/5 * * * *' };
