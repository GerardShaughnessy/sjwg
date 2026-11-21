import { siteUrl } from '../../env';
import { APPLICANT_TYPE_LABEL, AID_URGENCY_LABEL, type AidAnswers } from '@/lib/aid';
import { escapeHtml, paragraphs, shell, textFooter, button, type Email } from '../layout';

export const AID_LIMITED_FUNDS =
  'Our funds are limited. Every request is reviewed case by case, and we cannot promise help to everyone who applies.';

export const AID_NEXT_STEPS = [
  'A Guild officer reads your request and may call or email you with questions, or to verify what you wrote.',
  'If it is a project, we explain the case to tradesmen we know are open to charity work and ask whether one would take it on for free. If not, we ask for discounted work.',
  'Depending on the answer, we decide what financial relief, if any, the Guild can give, and we let you know.',
];

export interface AidEmailInput {
  id: string;
  ref: string;
  answers: Partial<AidAnswers>;
  files: { filename: string }[];
  filesFailed: number;
}

/**
 * To the officers: who, what kind, how urgent, and a link. The answers (address,
 * medical, money, faith) stay in the portal, never in an inbox.
 */
export function aidOfficerAlert(a: AidEmailInput): Email {
  const type = APPLICANT_TYPE_LABEL[a.answers.applicantType ?? ''] ?? 'Someone';
  const urgent = a.answers.urgency === 'emergency';
  const urgency = AID_URGENCY_LABEL[a.answers.urgency ?? ''] ?? 'Not given';
  const who = a.answers.orgName || a.answers.contactName || 'An applicant';
  const link = `${siteUrl()}/portal?tab=aid&aid=${a.id}`;
  const docs = a.files.length ? `${a.files.length}` : 'None';
  const failNote = a.filesFailed
    ? `${a.filesFailed} file${a.filesFailed === 1 ? '' : 's'} could not be saved. Ask the applicant to email ${a.filesFailed === 1 ? 'it' : 'them'}.`
    : '';
  const subject = `${urgent ? 'Urgent: ' : ''}Request for help ${a.ref}: ${who}`;
  const rows: [string, string][] = [
    ['From', who],
    ['Who is asking', type],
    ['How urgent', urgency],
    ['Documents', docs],
  ];
  const text = `${urgent ? 'URGENT. ' : ''}New request for help ${a.ref}

${rows.map(([l, v]) => `${l}: ${v}`).join('\n')}
${failNote ? `\n${failNote}\n` : ''}
The full application stays private in the portal. Open it there to read it and record a decision:
${link}${textFooter()}`;
  const html = shell({
    title: `${urgent ? 'Urgent: ' : ''}Request for help ${a.ref}`,
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:16px;line-height:1.5;color:#43402a">${rows
        .map(
          ([l, v]) =>
            `<tr><td style="padding:3px 16px 3px 0;color:#6b6450;vertical-align:top">${escapeHtml(l)}</td><td style="vertical-align:top">${escapeHtml(v)}</td></tr>`,
        )
        .join('')}</table>
      ${failNote ? `<p style="margin:12px 0;color:#483223;font-weight:700">${escapeHtml(failNote)}</p>` : ''}
      <p style="margin:16px 0;font-size:15px;color:#6b6450">The full application stays private in the portal.</p>
      ${button(link, 'Open in the portal')}`,
  });
  return { subject, text, html };
}

/** To the applicant: the reference, what happens next, and the limited-funds note. */
export function aidConfirmation(a: {
  ref: string;
  contactName: string;
  urgency: string;
  fileCount: number;
}): Email {
  const first = a.contactName.trim().split(/\s+/)[0] || 'there';
  const steps = AID_NEXT_STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const text = `Dear ${first},

Your request for help reached the St. Joseph the Worker Guild. Thank you for trusting us with it.

Reference number: ${a.ref}

What happens next
${steps}

${AID_LIMITED_FUNDS}

The Guild does not employ tradesmen. When we help with a project, we may pay a tradesman or supplier on your behalf.

What you sent stays private. Only Guild officers read it, only to review your request, and it is never sold.
How urgent you said it is: ${AID_URGENCY_LABEL[a.urgency] ?? a.urgency}
Documents received: ${a.fileCount}

If anything changes, reply to this email with your reference number.

St. Joseph, pray for us.${textFooter()}`;
  const html = shell({
    title: 'Your request reached the Guild',
    bodyHtml: `
      ${paragraphs(`Dear ${first},\n\nYour request for help reached the St. Joseph the Worker Guild. Thank you for trusting us with it.`)}
      <p style="margin:0 0 6px 0;font-size:14px;color:#6b6450;text-transform:uppercase;letter-spacing:0.06em">Reference number</p>
      <p style="margin:0 0 24px 0;font-family:Georgia,serif;font-size:30px;color:#43402a">${escapeHtml(a.ref)}</p>
      <h2 style="margin:0 0 8px 0;font-size:18px;color:#43402a">What happens next</h2>
      <ol style="margin:0 0 16px 0;padding-left:22px;font-size:17px;line-height:1.55;color:#43402a">
        ${AID_NEXT_STEPS.map((s) => `<li style="margin:0 0 8px 0">${escapeHtml(s)}</li>`).join('')}
      </ol>
      <div style="margin:0 0 16px 0;padding:12px 16px;border-left:4px solid #a37820;background:#f3ead5">
        ${paragraphs(`${AID_LIMITED_FUNDS}\n\nThe Guild does not employ tradesmen. When we help with a project, we may pay a tradesman or supplier on your behalf.`)}
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:16px;line-height:1.5;color:#43402a;margin:0 0 16px 0">
        <tr><td style="padding:2px 16px 2px 0;color:#6b6450">How urgent</td><td>${escapeHtml(AID_URGENCY_LABEL[a.urgency] ?? a.urgency)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6b6450">Documents received</td><td>${a.fileCount}</td></tr>
      </table>
      ${paragraphs('What you sent stays private. Only Guild officers read it, only to review your request, and it is never sold.\n\nIf anything changes, reply to this email with your reference number.\n\nSt. Joseph, pray for us.')}`,
  });
  return { subject: `Your request for help, ${a.ref}`, text, html };
}
