import { createContext, useContext } from 'react';
import type { Session } from '@/lib/types';

/** The logged-in session, for components deep in the portal (e.g. who may invite an officer). */
export const SessionContext = createContext<Session | null>(null);

export const useSession = () => useContext(SessionContext);
