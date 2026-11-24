import { describe, expect, it } from 'vitest';
import {
  DIGEST_WAIT_MS,
  accountGroups,
  appendNote,
  assertCanDeleteTime,
  assertCanLogTime,
  assertTaskManager,
  assertTaskPatchAllowed,
  formatMinutes,
  MAX_DIGEST_ATTEMPTS,
  planTaskDigests,
  taskEventText,
  type PendingNotification,
} from './task-rules';
import { HttpError } from './http';
import {
  guildToday,
  isCalendarDate,
  taskPatchSchema,
  taskTimeSchema,
  taskTimeSchemaAt,
} from './schemas';

const OFFICER = { userId: 'o', role: 'admin' as const };
const SAM = { userId: 'sam', role: 'member' as const };

function statusOf(fn: () => void): number | null {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof HttpError ? e.status : -1;
  }
}

describe('who may do what on the task board', () => {
  it('officers may change anything, create, and delete', () => {
    expect(
      statusOf(() => assertTaskPatchAllowed(OFFICER, false, ['title', 'assigneeIds'])),
    ).toBeNull();
    expect(statusOf(() => assertTaskManager(OFFICER))).toBeNull();
  });
  it('someone on the task may move it and add a note, nothing else', () => {
    expect(statusOf(() => assertTaskPatchAllowed(SAM, true, ['status']))).toBeNull();
    expect(statusOf(() => assertTaskPatchAllowed(SAM, true, ['status', 'addNote']))).toBeNull();
    expect(statusOf(() => assertTaskPatchAllowed(SAM, true, ['title']))).toBe(403);
    expect(statusOf(() => assertTaskPatchAllowed(SAM, true, ['assigneeIds']))).toBe(403);
    expect(statusOf(() => assertTaskPatchAllowed(SAM, true, ['dueDate']))).toBe(403);
  });
  it('a task someone is not on does not exist for them', () => {
    expect(statusOf(() => assertTaskPatchAllowed(SAM, false, ['status']))).toBe(404);
  });
  it('only officers create, delete, or assign', () => {
    expect(statusOf(() => assertTaskManager(SAM))).toBe(403);
  });
  it('time: people on the task or officers log; own entries or officers delete', () => {
    expect(statusOf(() => assertCanLogTime(SAM, true))).toBeNull();
    expect(statusOf(() => assertCanLogTime(SAM, false))).toBe(403);
    expect(statusOf(() => assertCanLogTime(OFFICER, false))).toBeNull();
    expect(statusOf(() => assertCanDeleteTime(SAM, { userId: 'sam' }))).toBeNull();
    expect(statusOf(() => assertCanDeleteTime(SAM, { userId: 'o' }))).toBe(403);
    expect(statusOf(() => assertCanDeleteTime(SAM, { userId: null }))).toBe(403);
    expect(statusOf(() => assertCanDeleteTime(OFFICER, { userId: 'sam' }))).toBeNull();
  });
});

describe('time and notes', () => {
  it('formats minutes', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(90)).toBe('1h 30m');
  });
  it('reads a time entry and refuses zero', () => {
    expect(taskTimeSchema.parse({ hours: '1', minutes: 30, workedOn: '2026-11-24' })).toEqual({
      hours: 1,
      minutes: 30,
      workedOn: '2026-11-24',
      note: '',
    });
    expect(taskTimeSchema.safeParse({ hours: 0, minutes: 0, workedOn: '2026-11-24' }).success).toBe(
      false,
    );
    expect(
      taskTimeSchema.safeParse({ hours: 1, minutes: 60, workedOn: '2026-11-24' }).success,
    ).toBe(false);
  });
  it('only takes a real date from 2026-01-01 through today in Chicago', () => {
    // 11:30 pm in Chicago on Nov 24 is already Nov 25 in UTC.
    const at = taskTimeSchemaAt(() => new Date('2026-11-25T05:30:00Z'));
    const ok = (workedOn: string) => at.safeParse({ hours: 1, minutes: 0, workedOn }).success;
    expect(guildToday(new Date('2026-11-25T05:30:00Z'))).toBe('2026-11-24');
    expect(ok('2026-11-24')).toBe(true);
    expect(ok('2026-11-25')).toBe(false);
    expect(ok('2026-01-01')).toBe(true);
    expect(ok('2025-12-31')).toBe(false);
    expect(ok('2026-02-31')).toBe(false);
    expect(ok('2026-13-01')).toBe(false);
    expect(ok('2026-2-3')).toBe(false);
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
  });
  it('one entry is 1 minute to 24 hours', () => {
    const at = taskTimeSchemaAt(() => new Date('2026-11-24T18:00:00Z'));
    const ok = (hours: number, minutes: number) =>
      at.safeParse({ hours, minutes, workedOn: '2026-11-20' }).success;
    expect(ok(0, 1)).toBe(true);
    expect(ok(24, 0)).toBe(true);
    expect(ok(24, 1)).toBe(false);
    expect(ok(25, 0)).toBe(false);
    expect(ok(0, 0)).toBe(false);
  });
  it('stamps an added note and accepts it in a patch', () => {
    expect(appendNote('', 'Sam', ' Called the IRS. ', 'Nov 24')).toBe(
      'Sam, Nov 24: Called the IRS.',
    );
    expect(appendNote('Old notes\n', 'Sam', 'More', 'Nov 24')).toBe(
      'Old notes\n\nSam, Nov 24: More',
    );
    expect(taskPatchSchema.parse({ addNote: 'Hi' })).toEqual({ addNote: 'Hi' });
  });
  it('the feed reads time logged', () => {
    expect(
      taskEventText({
        type: 'time_logged',
        actorName: 'Sam',
        toStatus: null,
        meta: { title: 'Banner', minutes: 120 },
      }),
    ).toBe("Sam logged 2h on 'Banner'.");
  });
});

describe('account groups', () => {
  const u = { role: 'member' as const, director: false, vendor: false, memberId: null };
  it('sorts people into the views', () => {
    expect(accountGroups({ ...u, memberId: 'm' })).toEqual(['tradesmen']);
    expect(accountGroups(u)).toEqual(['tradesmen']);
    expect(accountGroups({ ...u, role: 'admin', director: true })).toEqual(['officers', 'board']);
    expect(accountGroups({ ...u, vendor: true })).toEqual(['vendors']);
    expect(accountGroups({ ...u, director: true })).toEqual(['board']);
    expect(accountGroups({ ...u, director: true, memberId: 'm' })).toEqual(['board', 'tradesmen']);
  });
});

describe('batched assignment emails', () => {
  const now = new Date('2026-11-24T18:00:00Z');
  const ago = (min: number) => new Date(now.getTime() - min * 60_000);
  let n = 0;
  const row = (o: Partial<PendingNotification>): PendingNotification => ({
    id: `n${++n}`,
    userId: 'sam',
    email: 'sam@example.com',
    name: 'Sam Smith',
    disabled: false,
    stillAssigned: true,
    taskId: `t${n}`,
    title: `Task ${n}`,
    dueDate: null,
    addedByName: 'Greg',
    createdAt: ago(20),
    ...o,
  });

  it('waits 15 minutes from the oldest unsent row', () => {
    expect(DIGEST_WAIT_MS).toBe(15 * 60_000);
    expect(planTaskDigests([row({ createdAt: ago(14) })], now).digests).toHaveLength(0);
    expect(planTaskDigests([row({ createdAt: ago(15) })], now).digests).toHaveLength(1);
  });
  it('sends one email per person with every pending task, oldest first', () => {
    const rows = [
      row({ createdAt: ago(2), title: 'Newest' }),
      row({ createdAt: ago(16), title: 'Oldest' }),
      row({ createdAt: ago(9), title: 'Middle' }),
    ];
    const { digests } = planTaskDigests(rows, now);
    expect(digests).toHaveLength(1);
    expect(digests[0].items.map((i) => i.title)).toEqual(['Oldest', 'Middle', 'Newest']);
    expect(digests[0].ids).toHaveLength(3);
  });
  it('one pending task makes a one-item digest', () => {
    const { digests } = planTaskDigests([row({ title: 'Only' })], now);
    expect(digests[0].items).toHaveLength(1);
  });
  it('groups by person and holds back people who are not ready', () => {
    const { digests } = planTaskDigests(
      [
        row({ userId: 'sam' }),
        row({ userId: 'dee', email: 'dee@example.com', createdAt: ago(3) }),
        row({ userId: 'max', email: 'max@example.com', createdAt: ago(30) }),
        row({ userId: 'max', email: 'max@example.com', createdAt: ago(1) }),
      ],
      now,
    );
    expect(digests.map((d) => [d.userId, d.items.length])).toEqual([
      ['sam', 1],
      ['max', 2],
    ]);
  });
  it('drops disabled people and tasks they were taken off', () => {
    const off = row({ stillAssigned: false });
    const disabled = row({ userId: 'dee', disabled: true });
    const keep = row({});
    const { digests, discard } = planTaskDigests([off, disabled, keep], now);
    expect(discard.sort()).toEqual([off.id, disabled.id].sort());
    expect(digests[0].ids).toEqual([keep.id]);
  });
  it('drops tasks already Done without emailing', () => {
    const done = row({ done: true });
    const keep = row({});
    const { digests, discard } = planTaskDigests([done, keep], now);
    expect(discard).toEqual([done.id]);
    expect(digests[0].ids).toEqual([keep.id]);
    expect(MAX_DIGEST_ATTEMPTS).toBe(5);
  });
  it('an unassigned row does not make the rest wait or go early', () => {
    const { digests } = planTaskDigests(
      [row({ stillAssigned: false, createdAt: ago(60) }), row({ createdAt: ago(5) })],
      now,
    );
    expect(digests).toHaveLength(0);
  });
});
