import { useEffect, useState } from 'react';
import type { GuildEvent, Session } from '@/lib/types';
import { authClient } from '@/lib/auth-client';
import { useResource } from '@/lib/hooks';
import { portal } from '@/lib/api-portal';
import PortalShell, { type NavItem } from './PortalShell';
import { SubTabs } from './layout';
import MemberCalendar from './member/MemberCalendar';
import PostEditor from './member/PostEditor';
import DonorRecords from './member/DonorRecords';
import EventsEditor from './admin/EventsEditor';
import SponsorsEditor from './admin/SponsorsEditor';
import EmailListPanel from './admin/EmailListPanel';
import AnnouncementsPanel from './admin/AnnouncementsPanel';
import TasksBoard from './admin/TasksBoard';
import AidApplicationsPanel from './admin/AidApplicationsPanel';
import RsvpListPanel from './admin/RsvpList';
import { MyListing, TradesmanHome } from './pages/MemberPages';
import Dashboard from './pages/Dashboard';
import TradesmenPage from './pages/Tradesmen';
import OfficersPage from './pages/Officers';
import BoardPage from './pages/Board';
import { SessionContext } from './session-context';

interface Props {
  session: Session;
  events: GuildEvent[];
  areas: string[];
}

/**
 * Old ?tab= ids from emails and bookmarks, mapped to [page, sub-tab].
 * Officers and tradesmen land in different places for some of them.
 */
const OLD_MEMBER: Record<string, [string, string?]> = {
  jobs: ['home'],
  profile: ['listing'],
  paperwork: ['listing'],
};
const OLD_ADMIN: Record<string, [string, string?]> = {
  jobs: ['dashboard'],
  home: ['dashboard'],
  profile: ['listing'],
  paperwork: ['listing'],
  members: ['tradesmen', 'entries'],
  invitations: ['tradesmen'],
  signing: ['tradesmen', 'paperwork'],
  documents: ['tradesmen', 'documents'],
  announce: ['comms', 'announce'],
  emaillist: ['comms', 'emaillist'],
  posts: ['comms', 'posts'],
  donors: ['giving', 'donors'],
  sponsors: ['giving', 'sponsors'],
  calendar: ['events', 'calendar'],
  rsvps: ['events', 'rsvps'],
};

/** Query params that belong to one page and should not follow you to another. */
const PAGE_PARAMS: Record<string, string[]> = {
  tasks: ['task'],
  aid: ['aid'],
  tradesmen: ['show'],
};

/**
 * The portal for a logged-in Guild member. The page that renders this island
 * runs on demand and only reaches here with a verified session, so there is
 * no client-side gate. Officers get the officer pages.
 */
export default function PortalApp({ session, events, areas }: Props) {
  const isAdmin = session.role === 'admin';
  const [tab, setTab] = useState('');
  const [sub, setSub] = useState<string | undefined>();
  const [ready, setReady] = useState(false);
  const summary = useResource(() => portal.summary(), []);

  function resolve(id: string): [string, string?] {
    return (isAdmin ? OLD_ADMIN : OLD_MEMBER)[id] ?? [id];
  }

  /** Read ?tab= and ?sub= from the address bar. Old ?tab= ids name their sub-tab. */
  function readUrl() {
    const p = new URLSearchParams(window.location.search);
    const [t, s] = resolve(p.get('tab') ?? '');
    setTab(t);
    setSub(s ?? p.get('sub') ?? undefined);
  }

  useEffect(() => {
    readUrl();
    setReady(true);
    // Back and Forward move between portal pages.
    window.addEventListener('popstate', readUrl);
    return () => window.removeEventListener('popstate', readUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Go to a page, optionally with page params such as aid=<id> or sub=<sub-tab>.
   * A new page adds a history entry, so Back returns to the last page.
   */
  function go(next: string, query?: string) {
    const p = new URLSearchParams(window.location.search);
    for (const k of [...Object.values(PAGE_PARAMS).flat(), 'sub']) p.delete(k);
    const q = new URLSearchParams(query ?? '');
    q.forEach((v, k) => p.set(k, v));
    p.set('tab', next);
    const url = `${window.location.pathname}?${p}`;
    if (next === active) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
    setSub(q.get('sub') ?? undefined);
    setTab(next);
  }

  const badges = summary.data?.badges ?? {};
  const n = (k: string, one: string, many: string) =>
    `${badges[k] ?? 0} ${badges[k] === 1 ? one : many}`;
  const s = summary.data;
  const err = summary.error;

  /** Officers and directors both see the board. Board membership is separate from officer access. */
  const boardItem: NavItem = {
    id: 'board',
    label: 'Board',
    group: 'People',
    title: 'Board',
    lede: 'The board of directors. Some directors are also officers for now; the two will separate as the Guild grows.',
    content: <BoardPage session={session} />,
  };

  const memberItems: NavItem[] = [
    {
      id: 'home',
      label: 'Home',
      count: badges.home,
      countLabel: n('home', 'thing to do', 'things to do'),
      title: `Welcome, ${session.name.split(' ')[0]}`,
      lede: 'What needs your attention, and what is coming up.',
      content: <TradesmanHome summary={s} error={err} go={go} />,
    },
    {
      id: 'listing',
      label: 'My listing',
      title: 'My listing',
      lede: 'Your directory entry, your documents, and your paperwork, in one place.',
      content: <MyListing session={session} summary={s} error={err} areas={areas} />,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      title: 'Calendar',
      lede: 'Guild meetings, Holy Hours, and events.',
      content: <MemberCalendar initial={events} />,
    },
    {
      id: 'posts',
      label: 'Blog posts',
      group: 'Write',
      title: 'Blog posts',
      lede: 'Write a post for the Guild blog. An officer reviews it before it goes up.',
      content: <PostEditor session={session} />,
    },
    // A director who is not an officer keeps the tradesman pages, plus the board.
    ...(session.director ? [boardItem] : []),
  ];

  const adminItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      title: 'Dashboard',
      lede: 'Everything waiting on an officer, at a glance.',
      content: <Dashboard summary={s} error={err} go={go} />,
    },
    {
      id: 'tradesmen',
      label: 'Tradesmen',
      group: 'People',
      count: badges.tradesmen,
      countLabel: n('tradesmen', 'tradesman needs action', 'tradesmen need action'),
      title: 'Tradesmen',
      lede: 'Everyone listed or on the way: their checklist, documents, and paperwork.',
      content: <TradesmenPage areas={areas} initial={sub} />,
    },
    {
      id: 'officers',
      label: 'Officers',
      group: 'People',
      title: 'Officers',
      lede: session.siteAdmin
        ? 'Every Guild officer. As the Admin, you make and remove officers, set titles, and disable accounts.'
        : 'Every Guild officer, with their title and how to reach them.',
      content: <OfficersPage session={session} />,
    },
    boardItem,
    {
      id: 'aid',
      label: 'Help requests',
      group: 'Charity',
      count: badges.aid,
      countLabel: n('aid', 'new help request', 'new help requests'),
      title: 'Help requests',
      lede: 'Applications for financial help. Review each one and record a decision.',
      content: <AidApplicationsPanel />,
    },
    {
      id: 'events',
      label: 'Events and calendar',
      group: 'Guild life',
      title: 'Events and calendar',
      lede: 'What is on the public calendar and the portal calendar.',
      content: (
        <SubTabs
          label="Events views"
          initial={sub}
          tabs={[
            { id: 'edit', label: 'Events', content: <EventsEditor /> },
            { id: 'calendar', label: 'Calendar', content: <MemberCalendar initial={events} /> },
            { id: 'rsvps', label: 'Christmas RSVPs', content: <RsvpListPanel /> },
          ]}
        />
      ),
    },
    {
      id: 'tasks',
      label: 'Tasks',
      group: 'Guild life',
      count: badges.tasks,
      countLabel: n('tasks', 'open task', 'open tasks'),
      title: 'Tasks',
      lede: 'Who is doing what for the Guild.',
      content: <TasksBoard session={session} />,
    },
    {
      id: 'comms',
      label: 'Communications',
      group: 'Outreach',
      title: 'Communications',
      lede: 'Emails to tradesmen, the public email list, and the blog.',
      content: (
        <SubTabs
          label="Communications"
          initial={sub}
          tabs={[
            { id: 'announce', label: 'Email tradesmen', content: <AnnouncementsPanel /> },
            { id: 'emaillist', label: 'Public email list', content: <EmailListPanel /> },
            { id: 'posts', label: 'Blog posts', content: <PostEditor session={session} /> },
          ]}
        />
      ),
    },
    {
      id: 'giving',
      label: 'Giving',
      group: 'Outreach',
      title: 'Giving',
      lede: 'Donations, receipts, and sponsors.',
      content: (
        <SubTabs
          label="Giving"
          initial={sub}
          tabs={[
            { id: 'donors', label: 'Donations and receipts', content: <DonorRecords /> },
            { id: 'sponsors', label: 'Sponsors', content: <SponsorsEditor /> },
          ]}
        />
      ),
    },
    {
      id: 'listing',
      label: 'My own listing',
      group: 'You',
      title: 'My own listing',
      lede: 'Your directory entry and paperwork, like every tradesman.',
      content: <MyListing session={session} summary={s} error={err} areas={areas} />,
    },
  ];

  const items = isAdmin ? adminItems : memberItems;
  const active = items.some((t) => t.id === tab) ? tab : items[0].id;

  // Keep ?tab= and ?sub= in step with the page (old ids such as ?tab=members
  // become ?tab=tradesmen&sub=entries), and drop params that belong to another page.
  useEffect(() => {
    if (!ready) return;
    const p = new URLSearchParams(window.location.search);
    p.set('tab', active);
    if (sub) p.set('sub', sub);
    for (const [page, keys] of Object.entries(PAGE_PARAMS))
      if (page !== active) keys.forEach((k) => p.delete(k));
    window.history.replaceState(null, '', `${window.location.pathname}?${p}`);
  }, [active, sub, ready]);

  if (!ready)
    return (
      <p className="text-ash p-6 font-sans" aria-busy="true">
        Loading the portal.
      </p>
    );

  const fallbackLabel = isAdmin
    ? session.title || (session.siteAdmin ? 'Admin' : 'Guild officer')
    : '';
  return (
    <SessionContext.Provider value={session}>
      <PortalShell
        session={session}
        roleLabel={s?.roleLabel ?? fallbackLabel}
        items={items}
        active={active}
        onChange={(id) => go(id)}
        onLogout={async () => {
          try {
            await authClient().signOut();
          } catch {
            // Go home anyway; the session check there shows whether it worked.
          }
          window.location.assign('/');
        }}
      />
    </SessionContext.Provider>
  );
}
