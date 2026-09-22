import { useEffect, useState } from 'react';
import type { GuildEvent, Member, Session } from '@/lib/types';
import { authClient } from '@/lib/auth-client';
import PortalShell, { type Tab } from './PortalShell';
import JobBoard from './member/JobBoard';
import MemberCalendar from './member/MemberCalendar';
import ProfileEditor from './member/ProfileEditor';
import PostEditor from './member/PostEditor';
import DonorRecords from './member/DonorRecords';

interface Props {
  session: Session;
  members: Member[];
  events: GuildEvent[];
  areas: string[];
}

/**
 * The portal for a logged-in Guild member. The page that renders this island
 * runs on demand and only reaches here with a verified session, so there is
 * no client-side gate.
 */
export default function PortalApp({ session, members, events, areas }: Props) {
  const [tab, setTab] = useState('');

  useEffect(() => {
    setTab(new URLSearchParams(window.location.search).get('tab') ?? '');
  }, []);

  useEffect(() => {
    if (!session) return;
    const p = new URLSearchParams(window.location.search);
    if (tab) p.set('tab', tab);
    else p.delete('tab');
    const qs = p.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
  }, [tab, session]);

  const memberNames = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const me = members.find((m) => m.id === session.memberId) ?? members[0];

  const tabs: Tab[] = [
    {
      id: 'jobs',
      label: 'Job board',
      content: <JobBoard session={session} memberNames={memberNames} />,
    },
    { id: 'calendar', label: 'Calendar', content: <MemberCalendar events={events} /> },
    { id: 'profile', label: 'My entry', content: <ProfileEditor base={me} areas={areas} /> },
    { id: 'posts', label: 'Blog posts', content: <PostEditor /> },
    ...(session.role === 'admin'
      ? [{ id: 'donors', label: 'Donor records', content: <DonorRecords /> }]
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
