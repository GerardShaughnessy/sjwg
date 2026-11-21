import { describe, expect, it } from 'vitest';
import { aidConfirmation, aidOfficerAlert } from './templates/aid';

describe('aid emails', () => {
  it('tells officers who and how urgent, without the private answers', () => {
    const e = aidOfficerAlert({
      id: 'abc',
      ref: 'SJWG-ABC234',
      answers: {
        applicantType: 'family',
        contactName: 'Mary <Smith>',
        urgency: 'emergency',
        need: 'No heat.',
        faithImpact: 'Hard on the children.',
        helpKinds: ['materials'],
      },
      files: [{ filename: 'bid.pdf' }],
      filesFailed: 1,
    });
    expect(e.subject).toMatch(/^Urgent: Request for help SJWG-ABC234/);
    expect(e.text).not.toContain('Hard on the children.');
    expect(e.text).not.toContain('No heat.');
    expect(e.text).toContain('Documents: 1');
    expect(e.text).toContain('/portal?tab=aid&aid=abc');
    expect(e.text).toContain('1 file could not be saved');
    expect(e.html).toContain('Mary &lt;Smith&gt;');
    expect(e.html).not.toContain('<Smith>');
  });
  it('confirms to the applicant with the ref and the limited-funds note', () => {
    const e = aidConfirmation({
      ref: 'SJWG-ABC234',
      contactName: 'Mary Smith',
      urgency: 'weeks',
      fileCount: 0,
    });
    expect(e.subject).toContain('SJWG-ABC234');
    expect(e.text).toContain('Dear Mary');
    expect(e.text).toContain('Our funds are limited');
    expect(e.html).toContain('does not employ tradesmen');
  });
});
