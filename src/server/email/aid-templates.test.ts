import { describe, expect, it } from 'vitest';
import { aidConfirmation, aidOfficerAlert } from './templates/aid';

describe('aid emails', () => {
  it('gives officers every answer, escaped, and flags emergencies', () => {
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
    expect(e.text).toContain('Hard on the children.');
    expect(e.text).toContain('Paying for materials');
    expect(e.text).toContain('bid.pdf');
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
