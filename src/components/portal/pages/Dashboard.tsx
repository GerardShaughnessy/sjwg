import type { PortalSummary, Tone } from '@/lib/api-portal';
import { ErrorStrip, Loading } from '../ui';
import { Card, DOT, EventList, pLink } from '../layout';
import type { Go } from './MemberPages';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Officer home: four count tiles, recent activity, and what is coming up. */
export default function Dashboard({
  summary,
  error,
  go,
}: {
  summary: PortalSummary | null;
  error: string | null;
  go: Go;
}) {
  if (error && !summary) return <ErrorStrip>{error}</ErrorStrip>;
  if (!summary?.officer) return <Loading what="the dashboard" />;
  const c = summary.officer.counts;
  const tiles: { n: number; label: string; sub: string; tone: Tone; to: string; query?: string }[] = [
    {
      n: c.aidNew,
      label: 'New help requests',
      sub: c.aidEmergency ? `${c.aidEmergency} marked emergency` : 'None marked emergency',
      tone: c.aidEmergency ? 'attention' : c.aidNew ? 'waiting' : 'neutral',
      to: 'aid',
    },
    {
      n: c.docsPending,
      label: 'Member documents pending',
      sub: c.docsExpiring
        ? `${plural(c.docsExpiring, 'document')} expired or expiring in 30 days`
        : 'Nothing expiring in 30 days',
      tone: c.docsExpiring ? 'attention' : c.docsPending ? 'waiting' : 'neutral',
      to: 'tradesmen',
      query: 'show=action',
    },
    {
      n: c.paperworkOpen,
      label: 'Paperwork not signed',
      sub: c.paperworkStale
        ? `${c.paperworkStale} sent more than a week ago`
        : 'None sent more than a week ago',
      tone: c.paperworkStale ? 'attention' : c.paperworkOpen ? 'waiting' : 'neutral',
      to: 'tradesmen',
      query: 'sub=paperwork',
    },
    {
      n: c.tasksOpen,
      label: 'Open tasks',
      sub: c.tasksDueSoon ? `${c.tasksDueSoon} due this week` : 'None due this week',
      tone: c.tasksDueSoon ? 'waiting' : 'neutral',
      to: 'tasks',
    },
  ];
  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <button
              type="button"
              onClick={() => go(t.to, t.query)}
              className="border-mortar bg-paper hover:border-brass h-full w-full rounded-md border p-5 text-left"
            >
              <span className="flex items-start justify-between">
                <span className="font-serif text-[2.4rem] leading-none">{t.n}</span>
                <span className={`mt-1 h-2.5 w-2.5 rounded-full ${DOT[t.tone]}`} aria-hidden="true" />
              </span>
              <span className="mt-2 block font-sans font-semibold">{t.label}</span>
              <span className="text-ash block font-sans text-[0.85rem]">{t.sub}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Recent activity">
          {summary.officer.activity.length === 0 ? (
            <p className="text-ash font-sans">Nothing new in the last month.</p>
          ) : (
            <ul className="divide-mortar flex flex-col divide-y font-sans text-[0.95rem]">
              {summary.officer.activity.map((a, i) => (
                <li
                  key={`${a.at}-${i}`}
                  className="flex flex-col gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row"
                >
                  <span className="text-ash w-32 shrink-0 text-[0.85rem]">{a.when}</span>
                  {a.tab ? (
                    <a
                      href={`?tab=${a.tab}${a.query ? `&${a.query}` : ''}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                        e.preventDefault();
                        go(a.tab!, a.query);
                      }}
                      className="decoration-mortar hover:decoration-brass underline underline-offset-4"
                    >
                      {a.text}
                    </a>
                  ) : (
                    <span>{a.text}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Coming up">
          <EventList events={summary.upcoming} />
          <button type="button" className={`${pLink} mt-4`} onClick={() => go('events')}>
            Manage events
          </button>
        </Card>
      </div>
    </div>
  );
}
