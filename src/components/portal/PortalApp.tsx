import { useEffect, useState } from 'react';
import type { GuildEvent, Member, Session } from '@/lib/types';
import { auth } from '@/lib/store';
import PortalShell, { type Tab } from './PortalShell';
import JobBoard from './member/JobBoard';
import MemberCalendar from './member/MemberCalendar';
import ProfileEditor from './member/ProfileEditor';
import PostEditor from './member/PostEditor';
import DonorRecords from './member/DonorRecords';
import MyRequests from './customer/MyRequests';

interface Props {
  members: Member[];
  events: GuildEvent[];
  areas: string[];
}

/**
 * Role gate for the faked portal. A static host cannot protect this route,
 * so the gate is client-side and the page is noindex. Real auth replaces this.
 */
export default function PortalApp({ members, events, areas }: Props) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState('');

  useEffect(() => {
    const s = auth.current();
    if (!s) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login?next=${next}`);
      return;
    }
    setSession(s);
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

  if (session === undefined) return <p className="text-ash font-sans">Checking your login.</p>;
  if (!session) return null;

  const memberNames = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const me = members.find((m) => m.id === session.memberId) ?? members[0];

  const tabs: Tab[] =
    session.role === 'member'
      ? [
          {
            id: 'jobs',
            label: 'Job board',
            content: <JobBoard session={session} memberNames={memberNames} />,
          },
          { id: 'calendar', label: 'Calendar', content: <MemberCalendar events={events} /> },
          { id: 'profile', label: 'My entry', content: <ProfileEditor base={me} areas={areas} /> },
          { id: 'posts', label: 'Blog posts', content: <PostEditor /> },
          { id: 'donors', label: 'Donor records', content: <DonorRecords /> },
        ]
      : [{ id: 'requests', label: 'My requests', content: <MyRequests /> }];

  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  return (
    <PortalShell
      session={session}
      tabs={tabs}
      active={active}
      onChange={setTab}
      onLogout={() => {
        auth.logout();
        window.location.assign('/');
      }}
    />
  );
}
