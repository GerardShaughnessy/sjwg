import type { Session } from '@/lib/types';
import { SubTabs } from '../layout';
import TasksBoard from './TasksBoard';
import TimeSummary from './TimeSummary';

/** Tasks for every account: the board, and a Time summary beside it. */
export default function TasksPage({ session, initial }: { session: Session; initial?: string }) {
  return (
    <SubTabs
      label="Tasks views"
      initial={initial}
      tabs={[
        { id: 'board', label: 'Board', content: <TasksBoard session={session} /> },
        { id: 'time', label: 'Time', content: <TimeSummary session={session} /> },
      ]}
    />
  );
}
