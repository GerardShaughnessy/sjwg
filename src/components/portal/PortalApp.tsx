import { useEffect, useState } from 'react';
import type { GuildEvent, Member, Session } from '@/lib/types';
import { authClient } from '@/lib/auth-client';
import PortalShell, { type Tab } from './PortalShell';
import JobBoard from './member/JobBoard';
import MemberCalendar from './member/MemberCalendar';
import ProfileEditor from './member/ProfileEditor';
import PostEditor from './member/PostEditor';
import DonorRecords from './member/DonorRecords';
import EventsEditor from './admin/EventsEditor';
import SponsorsEditor from './admin/SponsorsEditor';
import InvitationsPanel from './admin/InvitationsPanel';
import MembersAdmin from './admin/MembersAdmin';
import AnnouncementsPanel from './admin/AnnouncementsPanel';

interface Props {
  session: Session;
  members: Member[];
  events: GuildEvent[];
  areas: string[];
}

/**
 * The portal for a logged-in Guild member. The page that renders this island
 * runs on demand and only reaches here with a verified session, so there is
 * no client-side gate. Officers get the admin tabs.
 */
export default function PortalApp({ session, members, events, areas }: Props) {
  const [tab, setTab] = useState('');

  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get('tab') ?? '');
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [tab]);

  const isAdmin = session.role === 'admin';
  const tabs: Tab[] = [
    { id: 'jobs', label: 'Job board', content: <JobBoard session={session} /> },
    { id: 'calendar', label: 'Calendar', content: <MemberCalendar initial={events} /> },
    { id: 'profile', label: 'My entry', content: <ProfileEditor areas={areas} /> },
    { id: 'posts', label: 'Blog posts', content: <PostEditor session={session} /> },
    ...(isAdmin
      ? [
          { id: 'events', label: 'Events', content: <EventsEditor /> },
          { id: 'sponsors', label: 'Sponsors', content: <SponsorsEditor /> },
          { id: 'donors', label: 'Donor records', content: <DonorRecords /> },
          {
            id: 'invitations',
            label: 'Invitations',
            content: <InvitationsPanel members={members} />,
          },
        ]
      : []),
  ];

  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <PortalShell
      session={session}
      tabs={tabs}
      active={active}
      onChange={setTab}
      onLogout={async () => {
        await authClient().signOut();
        window.location.assign('/');
      }}
    />
  );
}
