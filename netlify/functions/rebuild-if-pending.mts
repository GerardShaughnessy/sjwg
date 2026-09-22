import type { Config } from '@netlify/functions';
import { flushPendingRebuild } from '../../src/server/build-hook';

/** Hourly: if a content change was coalesced, fire the publish build hook now. */
export default async () => {
  const outcome = await flushPendingRebuild();
  console.log(`[rebuild-if-pending] ${outcome}`);
  return new Response(outcome);
};

export const config: Config = { schedule: '@hourly' };
