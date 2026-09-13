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

export interface HelpRequest extends Omit<RequestAnswers, 'photoName' | 'urgency'> {
  id: string;
  ref: string;
  createdAt: string;
  status: RequestStatus;
  urgency: Urgency;
  photoName?: string;
  owner: 'seed' | 'local';
  claimedBy?: string;
  notes?: string;
}

export type Role = 'member' | 'customer';

export interface Session {
  email: string;
  role: Role;
  name: string;
  memberId?: string;
  at: string;
}

export interface PostDraft {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface Donation {
  id: string;
  date: string;
  donorName: string;
  amount: number;
  method: 'check' | 'card' | 'cash' | 'other';
  fund: string;
  tier: string;
  recurring: boolean;
}

export interface ReminderPrefs {
  email: boolean;
  sms: boolean;
  phone: string;
}

export type FormKind = 'contact' | 'partner' | 'membership';

export interface FormSubmission {
  id: string;
  kind: FormKind;
  payload: Record<string, string>;
  at: string;
}
