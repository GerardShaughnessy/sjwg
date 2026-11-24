import type { Session } from '@/lib/types';
import { SubTabs } from '../layout';
import TasksArchive from './TasksArchive';
import TasksBoard from './TasksBoard';
import TimeSummary from './TimeSummary';

/** Tasks for every account: the board, a Time summary, and the Archive of older finished tasks. */
export default function TasksPage({ session, initial }: { session: Session; initial?: string }) {
  return (
    <SubTabs
      label="Tasks views"
      initial={initial}
      tabs={[
        {
          id: 'board',
          label: 'Board',
          content: (go) => <TasksBoard session={session} onArchive={() => go('archive')} />,
        },
        { id: 'time', label: 'Time', content: <TimeSummary session={session} /> },
        { id: 'archive', label: 'Archive', content: <TasksArchive session={session} /> },
      ]}
    />
  );
}
