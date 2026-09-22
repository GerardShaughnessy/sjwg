/**
 * Browser-only state. Everything else now lives on the server behind api.ts.
 * The wizard draft stays in sessionStorage so a refresh mid-flow keeps the answers.
 */
import type { RequestAnswers } from './types';
import { KEYS, getJSON, removeKey, setJSON } from './storage';

export const requestDraft = {
  get(): { step: number; answers: Partial<RequestAnswers> } | null {
    return getJSON(KEYS.requestDraft, null, 'session');
  },
  set(step: number, answers: Partial<RequestAnswers>) {
    setJSON(KEYS.requestDraft, { step, answers }, 'session');
  },
  clear() {
    removeKey(KEYS.requestDraft, 'session');
  },
};
