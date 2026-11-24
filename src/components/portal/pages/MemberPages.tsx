import type { Session } from '@/lib/types';
import type { MySummary, PortalSummary, Todo } from '@/lib/api-portal';
import ProfileEditor from '../member/ProfileEditor';
import MyDocuments from '../member/MyDocuments';
import { ErrorStrip, Loading } from '../ui';
import { Badge, Card, Checklist, EventList, ProgressBar, pBtn, pBtnQuiet, pLink } from '../layout';
import { AgreementTodo } from '../agreements';

export type Go = (tab: string, query?: string) => void;

/** Four required items count (paperwork, Baptism, Confirmation, insurance), plus a license once uploaded. */
function progressWord(m: MySummary): { tone: 'done' | 'waiting' | 'neutral'; word: string } {
  if (m.tone === 'done') return { tone: 'done', word: m.listed ? 'Listed' : 'Ready to list' };
  if (m.done >= 3) return { tone: 'waiting', word: 'Almost ready' };
  return { tone: 'neutral', word: 'Getting started' };
}

function TodoList({ todos, go }: { todos: Todo[]; go: Go }) {
  if (todos.length === 0)
    return <p className="text-ash font-sans">Nothing to do right now. Thank you.</p>;
  return (
    <ul className="divide-mortar flex flex-col divide-y font-sans">
      {todos.map((t, i) => (
        <li
          key={t.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="font-semibold">{t.title}</p>
            <p className="text-ash text-[0.9rem]">{t.detail}</p>
          </div>
          {t.action && t.href ? (
            <a href={t.href} className={i === 0 ? pBtn : pBtnQuiet}>
              {t.action}
            </a>
          ) : t.action && t.tab ? (
            <button
              type="button"
              className={i === 0 ? pBtn : pBtnQuiet}
              onClick={() => go(t.tab!)}
            >
              {t.action}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function TradesmanHome({
  summary,
  error,
  go,
}: {
  summary: PortalSummary | null;
  error: string | null;
  go: Go;
}) {
  if (error && !summary) return <ErrorStrip>{error}</ErrorStrip>;
  if (!summary) return <Loading what="your home page" />;
  const m = summary.mine;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {summary.agreements.some((a) => a.state === 'sent') && (
        <div className="lg:col-span-2">
          <AgreementTodo agreements={summary.agreements} />
        </div>
      )}
      <Card title="To do">
        {m ? (
          <TodoList todos={m.todos} go={go} />
        ) : (
          <NotLinked />
        )}
      </Card>
      <Card title="Your listing">
        {m ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 font-sans">
              <p className="font-semibold">
                {m.done} of {m.total} done
              </p>
              <Badge tone={progressWord(m).tone}>{progressWord(m).word}</Badge>
            </div>
            <ProgressBar done={m.done} total={m.total} />
            <button type="button" className={`${pLink} mt-4`} onClick={() => go('listing')}>
              See your checklist
            </button>
          </>
        ) : (
          <p className="text-ash font-sans">No directory entry is linked to your login.</p>
        )}
      </Card>
      <Card title="Coming up" className="lg:col-span-2">
        <EventList events={summary.upcoming} />
        <button type="button" className={`${pLink} mt-4`} onClick={() => go('calendar')}>
          See the calendar
        </button>
      </Card>
    </div>
  );
}

function NotLinked() {
  return (
    <p className="font-sans leading-relaxed">
      Your login is not linked to a directory entry yet. Ask a Guild officer to link it, or write
      to{' '}
      <a href="mailto:hello@sjwg.org" className="underline">
        hello@sjwg.org
      </a>
      .
    </p>
  );
}

/**
 * The tradesman's checklist, directory entry, and documents on one page. The
 * paperwork list lives inside My documents, so it is not repeated here.
 */
export function MyListing({
  session,
  summary,
  error,
  areas,
}: {
  session: Session;
  summary: PortalSummary | null;
  error: string | null;
  areas: string[];
}) {
  if (!session.memberId)
    return (
      <Card>
        <p className="font-sans leading-relaxed">
          {session.role === 'admin'
            ? 'Your login is not linked to a directory entry, so there is no listing to show. If you work a trade and want to be listed, ask another officer to link your login to your entry.'
            : 'Your login is not linked to a directory entry yet.'}
        </p>
        {session.role !== 'admin' && (
          <div className="mt-3">
            <NotLinked />
          </div>
        )}
      </Card>
    );
  const m = summary?.mine;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Card
        className="self-start"
        title="Checklist"
        action={
          m ? (
            <Badge tone={m.tone === 'done' ? 'done' : 'waiting'}>
              {m.done} of {m.total} done
            </Badge>
          ) : undefined
        }
      >
        {m ? (
          <Checklist items={m.checklist} />
        ) : error ? (
          <ErrorStrip>{error}</ErrorStrip>
        ) : summary ? (
          <p className="text-ash font-sans">No checklist to show.</p>
        ) : (
          <Loading what="your checklist" />
        )}
        <p className="text-ash mt-4 font-sans text-[0.85rem]">
          A trade license counts only if your trade needs one.
        </p>
      </Card>
      <Card>
        <MyDocuments session={session} />
      </Card>
      <Card className="lg:col-span-2">
        <ProfileEditor areas={areas} />
      </Card>
    </div>
  );
}
