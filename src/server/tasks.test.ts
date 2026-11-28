import { describe, expect, it } from 'vitest';
import { assertTaskSection, resolveAssigneeIds, taskPatchSchema, taskSchema } from './schemas';
import { taskAssigned, taskFinished, tasksAssignedBatch } from './email/templates/task';
import { confirmPlan, taskEmailPlan, taskEventText, joinNames } from './task-rules';

const ME = '11111111-1111-4111-8111-111111111111';
const GREG = '22222222-2222-4222-8222-222222222222';
const SAM = '33333333-3333-4333-8333-333333333333';
const MILTON = '44444444-4444-4444-8444-444444444444';

const plan = (o: Partial<Parameters<typeof taskEmailPlan>[0]>) =>
  taskEmailPlan({
    before: [],
    after: undefined,
    actorId: ME,
    fromStatus: 'todo',
    toStatus: 'todo',
    alreadyFinished: false,
    ...o,
  });

describe('who hears about a task save', () => {
  it('self-assigning sends nothing', () => {
    const p = plan({ fromStatus: null, after: [ME] });
    expect(p.added).toEqual([ME]);
    expect(p.notify).toEqual([]);
    expect(p.finished).toBe(false);
  });
  it('adding three people emails each of them, but not the actor', () => {
    expect(plan({ fromStatus: null, after: [GREG, SAM, MILTON] }).notify).toEqual([
      GREG,
      SAM,
      MILTON,
    ]);
    expect(plan({ before: [ME], after: [ME, GREG, SAM, MILTON] }).notify).toEqual([
      GREG,
      SAM,
      MILTON,
    ]);
  });
  it('re-adding someone already on the task sends nothing', () => {
    const p = plan({ before: [GREG], after: [GREG, GREG] });
    expect(p.notify).toEqual([]);
    expect(p.added).toEqual([]);
  });
  it('removing people sends nothing but is recorded', () => {
    const p = plan({ before: [GREG, SAM], after: [SAM] });
    expect(p.notify).toEqual([]);
    expect(p.removed).toEqual([GREG]);
  });
  it('a save that does not touch assignees changes nobody', () => {
    expect(plan({ before: [GREG], after: undefined, toStatus: 'doing' })).toEqual({
      added: [],
      removed: [],
      notify: [],
      finished: false,
    });
  });
  it('the first move into Done sends the finished email; the second does not', () => {
    expect(plan({ fromStatus: 'doing', toStatus: 'done' }).finished).toBe(true);
    expect(plan({ fromStatus: 'todo', toStatus: 'done', alreadyFinished: true }).finished).toBe(
      false,
    );
  });
  it('saving a task that is already Done does not count as finishing it', () => {
    expect(plan({ fromStatus: 'done', toStatus: 'done' }).finished).toBe(false);
  });
  it('other moves send nothing, even on your own task', () => {
    for (const [from, to] of [
      ['todo', 'doing'],
      ['doing', 'waiting'],
      ['done', 'todo'],
    ] as const) {
      const p = plan({ before: [ME], fromStatus: from, toStatus: to });
      expect(p.notify).toEqual([]);
      expect(p.finished).toBe(false);
    }
  });
});

describe('duplicate adds and finishes never double-email', () => {
  it('only people whose row this save inserted are emailed and logged', () => {
    // Two saves race to add Greg and Sam: the first inserted both rows.
    const draft = plan({ before: [ME], after: [ME, GREG, SAM] });
    const first = confirmPlan(draft, { inserted: [GREG, SAM], finishedLogged: false });
    expect(first.notify).toEqual([GREG, SAM]);
    // The second save's insert hit ON CONFLICT DO NOTHING and returned no rows.
    const second = confirmPlan(draft, { inserted: [], finishedLogged: false });
    expect(second.notify).toEqual([]);
    expect(second.added).toEqual([]);
    // A partial overlap emails only the one actually added.
    expect(confirmPlan(draft, { inserted: [SAM], finishedLogged: false }).notify).toEqual([SAM]);
  });
  it('the actor is still never emailed, even when inserted', () => {
    const draft = plan({ fromStatus: null, after: [ME, GREG] });
    expect(confirmPlan(draft, { inserted: [ME, GREG], finishedLogged: false }).notify).toEqual([
      GREG,
    ]);
  });
  it('hello@ hears only when this save inserted the finished event', () => {
    const draft = plan({ fromStatus: 'doing', toStatus: 'done' });
    expect(confirmPlan(draft, { inserted: [], finishedLogged: true }).finished).toBe(true);
    // A second finish (double click, or a backfilled Done task) lost on task_events_finished_once.
    expect(confirmPlan(draft, { inserted: [], finishedLogged: false }).finished).toBe(false);
    // And a logged event never turns a non-finish into one.
    expect(
      confirmPlan(plan({ toStatus: 'doing' }), { inserted: [], finishedLogged: true }).finished,
    ).toBe(false);
  });
});

describe('the old single assigneeId', () => {
  it('maps to a list, and assigneeIds wins when both are sent', () => {
    expect(resolveAssigneeIds({ assigneeId: GREG })).toEqual([GREG]);
    expect(resolveAssigneeIds({ assigneeId: null })).toEqual([]);
    expect(resolveAssigneeIds({})).toBeUndefined();
    expect(resolveAssigneeIds({ assigneeId: GREG, assigneeIds: [SAM, SAM] })).toEqual([SAM]);
  });
  it('on a PATCH, a lone assigneeId adds to a multi-person list instead of replacing it', () => {
    const current = [GREG, SAM];
    expect(resolveAssigneeIds({ assigneeId: MILTON }, current)).toEqual([GREG, SAM, MILTON]);
    // Already on it, or null: the list stays as is.
    expect(resolveAssigneeIds({ assigneeId: SAM }, current)).toBeUndefined();
    expect(resolveAssigneeIds({ assigneeId: null }, current)).toBeUndefined();
    // assigneeIds still replaces it.
    expect(resolveAssigneeIds({ assigneeIds: [MILTON] }, current)).toEqual([MILTON]);
  });
  it('with one person or none, a lone assigneeId still replaces as before', () => {
    expect(resolveAssigneeIds({ assigneeId: MILTON }, [GREG])).toEqual([MILTON]);
    expect(resolveAssigneeIds({ assigneeId: null }, [GREG])).toEqual([]);
    expect(resolveAssigneeIds({ assigneeId: GREG }, [])).toEqual([GREG]);
  });
  it('both forms validate', () => {
    expect(taskSchema.parse({ title: 'x', assigneeIds: [GREG, SAM] }).assigneeIds).toEqual([
      GREG,
      SAM,
    ]);
    expect(taskPatchSchema.parse({ assigneeId: GREG })).toEqual({ assigneeId: GREG });
    expect(taskSchema.safeParse({ title: 'x', assigneeIds: ['nope'] }).success).toBe(false);
  });
});

describe('task feed lines', () => {
  const e = (type: string, extra: Partial<Parameters<typeof taskEventText>[0]> = {}) =>
    taskEventText({
      type,
      actorName: 'Max',
      toStatus: null,
      meta: { title: 'Order RSVP cards' },
      ...extra,
    });
  it('reads like a sentence', () => {
    expect(e('moved', { toStatus: 'doing' })).toBe("Max moved 'Order RSVP cards' to Doing.");
    expect(e('finished', { actorName: 'Paul', meta: { title: 'Banner to Hi-Tech' } })).toBe(
      "Paul finished 'Banner to Hi-Tech'.",
    );
    expect(
      e('assigned', { actorName: 'Greg', meta: { title: 'X', names: ['Sam', 'Milton'] } }),
    ).toBe("Greg assigned 'X' to Sam and Milton.");
    expect(e('assigned', { meta: { title: 'X', names: ['Max'], self: true } })).toBe(
      "Max took 'X'.",
    );
    expect(e('created', { meta: { title: 'X', names: [] } })).toBe("Max added 'X'.");
    expect(e('created', { meta: { title: 'X', names: ['Max'] } })).toBe(
      "Max added 'X' and took it.",
    );
    expect(e('deleted')).toBe("Max deleted 'Order RSVP cards'.");
    expect(e('unknown')).toBeNull();
  });
  it('joins names plainly', () => {
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B, and C');
  });
});

describe('task validation', () => {
  it('fills defaults and requires a title', () => {
    const t = taskSchema.parse({ title: '  File the articles  ' });
    expect(t).toMatchObject({ title: 'File the articles', status: 'todo', assigneeId: null });
    expect(t.assigneeIds).toBeUndefined();
    expect(taskSchema.safeParse({ title: '' }).success).toBe(false);
  });
  it('rejects unknown columns, sections, and bad dates', () => {
    expect(taskSchema.safeParse({ title: 'x', status: 'blocked' }).success).toBe(false);
    expect(taskSchema.safeParse({ title: 'x', section: 'Misc' }).success).toBe(false);
    expect(taskSchema.safeParse({ title: 'x', dueDate: '10/5/2026' }).success).toBe(false);
    expect(taskSchema.safeParse({ title: 'x', dueDate: '2026-10-05' }).success).toBe(true);
  });
  it('a drag sends only the status, and nothing else is defaulted', () => {
    expect(taskPatchSchema.parse({ status: 'done' })).toEqual({ status: 'done' });
  });
  it('an edit may keep an old section, but a change needs one from the list', () => {
    expect(taskPatchSchema.parse({ section: 'Old stuff' })).toEqual({ section: 'Old stuff' });
    expect(() => assertTaskSection('Old stuff', 'Old stuff')).not.toThrow();
    expect(() => assertTaskSection(undefined, 'Old stuff')).not.toThrow();
    expect(() => assertTaskSection('Money', 'Old stuff')).not.toThrow();
    expect(() => assertTaskSection('Misc', 'General')).toThrow('Pick a section.');
  });
});

describe('task emails', () => {
  it('links straight to the card, escapes notes, and uses no em dashes', () => {
    const e = taskAssigned({
      id: 'abc',
      title: 'Get the EIN',
      notes: 'Only after <articles> are filed.',
      section: 'Paperwork',
      dueDate: '2026-10-05',
      assignedBy: 'Gerard',
      name: 'Greg',
    });
    expect(e.subject).toBe('Task for you: Get the EIN');
    expect(e.text).toContain('/portal?tab=tasks&task=abc');
    expect(e.text).toContain('Monday, October 5');
    expect(e.html).toContain('&lt;articles&gt;');
    expect(e.text + e.html).not.toMatch(/—/);
  });
  it('one pending task reads as that task', () => {
    const e = tasksAssignedBatch({
      name: 'Greg',
      items: [{ id: 'abc', title: 'Get the EIN', dueDate: '2026-10-05', assignedBy: 'Gerard' }],
    });
    expect(e.subject).toBe('New task: Get the EIN');
    expect(e.text).toContain('Due Monday, October 5. From Gerard.');
    expect(e.text).toContain('/portal?tab=tasks&task=abc');
  });
  it('several pending tasks read as "You have N new tasks", each with a link', () => {
    const e = tasksAssignedBatch({
      name: 'Greg',
      items: [
        { id: 'a1', title: 'A <b>', dueDate: '', assignedBy: 'Gerard' },
        { id: 'b2', title: 'B', dueDate: '2026-10-05', assignedBy: '' },
      ],
    });
    expect(e.subject).toBe('You have 2 new tasks on the Guild board');
    expect(e.text).toContain('task=a1');
    expect(e.text).toContain('task=b2');
    expect(e.text).toContain('No due date. From Gerard.');
    expect(e.html).toContain('A &lt;b&gt;');
    expect(e.text + e.html).not.toMatch(/—/);
  });
});

describe('the finished email', () => {
  it('names who finished what and links to the card', () => {
    const e = taskFinished({
      id: 'abc',
      title: 'Banner to Hi-Tech',
      section: 'General',
      by: 'Paul Voss',
    });
    expect(e.subject).toBe('Paul Voss finished Banner to Hi-Tech');
    expect(e.text).toContain('/portal?tab=tasks&task=abc');
    expect(e.text + e.html).not.toMatch(/—/);
  });
});
