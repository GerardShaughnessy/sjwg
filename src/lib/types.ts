export type Availability = 'available' | 'limited' | 'unavailable';

export interface Member {
  id: string;
  name: string;
  trade: string;
  areas: string[];
  yearsInTrade: number;
  bio: string;
  availability: Availability;
  featured: boolean;
  photo: string | null;
}

export type EventKind =
  'mass' | 'meeting' | 'retreat' | 'procession' | 'workday' | 'party' | 'other';

export interface GuildEvent {
  id: string;
  slug: string;
  title: string;
  kind: EventKind;
  start: string;
  end?: string;
  location: string;
  summary: string;
  body: string;
  membersOnly: boolean;
  tk?: string;
}

export type Urgency = 'can-wait' | 'getting-worse' | 'no-heat-or-water';
export type RequestStatus = 'open' | 'claimed' | 'referred' | 'closed';

export interface RequestContact {
  name: string;
  phone: string;
  email: string;
  bestTime: string;
}

/** What the wizard collects. Photo bytes are never stored; only its name. */
export interface RequestAnswers {
  trade: string;
  tradeSlug: string;
  description: string;
  photoName: string;
  urgency: Urgency | '';
  zip: string;
  neighborhood: string;
  contact: RequestContact;
}

export type Role = 'admin' | 'member';

/** Mirror of the server's AppSession, passed to the portal as a prop. */
export interface Session {
  userId: string;
  email: string;
  role: Role;
  name: string;
  memberId: string | null;
}

export type FormKind = 'contact' | 'partner' | 'membership';
