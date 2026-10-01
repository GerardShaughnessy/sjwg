import { describe, expect, it } from 'vitest';
import { assigneeToNotify } from './db/queries/tasks';
import { taskPatchSchema, taskSchema } from './schemas';
import { taskAssigned, tasksAssignedDigest } from './email/templates/task';

const ME = '11111111-1111-4111-8111-111111111111';
const GREG = '22222222-2222-4222-8222-222222222222';

describe('who hears about a task', () => {
  it('emails the new assignee when someone else assigns it', () => {
    expect(assigneeToNotify(null, GREG, ME)).toBe(GREG);
    expect(assigneeToNotify(ME, GREG, ME)).toBe(GREG);
  });
  it('stays quiet when assigning yourself, unassigning, or not changing the assignee', () => {
    expect(assigneeToNotify(null, ME, ME)).toBeNull();
    expect(assigneeToNotify(GREG, null, ME)).toBeNull();
    expect(assigneeToNotify(GREG, GREG, ME)).toBeNull();
    expect(assigneeToNotify(GREG, undefined, ME)).toBeNull();
  });
});

describe('task validation', () => {
  it('fills defaults and requires a title', () => {
    const t = taskSchema.parse({ title: '  File the articles  ' });
    expect(t).toMatchObject({ title: 'File the articles', status: 'todo', assigneeId: null });
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
  it('the digest lists every title once', () => {
    const e = tasksAssignedDigest({ titles: ['A', 'B'], assignedBy: 'Gerard', name: 'Greg' });
    expect(e.subject).toBe('2 tasks for you on the Guild board');
    expect(e.text).toContain('- A\n- B');
  });
});
