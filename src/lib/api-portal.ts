/**
 * Browser client for the portal summary. Types come from the server module
 * as type-only imports, so no server code reaches the island.
 */
import type { PortalSummary, TradesmanRow } from '@/server/portal-summary';
import { call } from './api';

export type {
  PortalSummary,
  TradesmanRow,
  UpcomingEvent,
  MySummary,
  OfficerCounts,
} from '@/server/portal-summary';
export type { ChecklistItem, Todo, Tone, ActivityItem } from '@/server/portal-status';
export type { AgreementStatus, AgreementState } from '@/server/agreement-rules';

export const portal = {
  summary: () => call<PortalSummary>('/api/portal/summary'),
  tradesmen: () =>
    call<{ tradesmen: TradesmanRow[] }>('/api/portal/tradesmen').then((r) => r.tradesmen),
};
