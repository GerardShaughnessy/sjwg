import { TK } from '@/config/site';
import { siteUrl } from '../../env';
import { button, escapeHtml, paragraphs, shell, textFooter, type Email } from '../layout';

export const URGENCY_LABEL: Record<string, string> = {
  'can-wait': 'It can wait a little',
  'getting-worse': 'It is getting worse',
  'no-heat-or-water': 'No heat, no water, or not safe',
};

export interface RequestSummary {
  ref: string;
  trade: string;
  description: string;
  urgency: string;
  zip: string;
  neighborhood: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bestTime: string;
  photoCount: number;
}

export function requestConfirmation(r: RequestSummary, trackingToken: string): Email {
  const link = `${siteUrl()}/request/track/${trackingToken}`;
  const whatNext = TK.responseCommitment.sample;
  const text = `Your request reached the Guild.

Reference number: ${r.ref}

What happens next
${whatNext}

Check on it, or add a note, any time at this private link:
${link}

What you sent
Help with: ${r.trade}
How urgent: ${URGENCY_LABEL[r.urgency] ?? r.urgency}
Where: ${[r.zip, r.neighborhood].filter(Boolean).join(', ')}
${r.description}

Keep this email. The link is the only way to see your request, so do not forward it to anyone you would not want reading it.${textFooter()}`;
  const html = shell({
    title: 'Your request reached the Guild',
    bodyHtml: `
      <p style="margin:0 0 6px 0;font-size:14px;color:#6e6560;text-transform:uppercase;letter-spacing:0.06em">Reference number</p>
      <p style="margin:0 0 24px 0;font-family:Georgia,serif;font-size:30px;color:#2b2624">${escapeHtml(r.ref)}</p>
      <h2 style="margin:0 0 8px 0;font-size:18px;color:#2b2624">What happens next</h2>
      ${paragraphs(whatNext)}
      ${button(link, 'Check on your request')}
      <h2 style="margin:8px 0 8px 0;font-size:18px;color:#2b2624">What you sent</h2>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:16px;line-height:1.5;color:#2b2624">
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">Help with</td><td>${escapeHtml(r.trade)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">How urgent</td><td>${escapeHtml(URGENCY_LABEL[r.urgency] ?? r.urgency)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">Where</td><td>${escapeHtml([r.zip, r.neighborhood].filter(Boolean).join(', '))}</td></tr>
      </table>
      <div style="margin:12px 0 20px 0;padding:12px 16px;border-left:4px solid #b08d57;background:#efeae4">${paragraphs(r.description)}</div>
      <p style="margin:0;font-size:14px;line-height:1.5;color:#6e6560">Keep this email. The link is the only way to see your request, so do not forward it to anyone you would not want reading it.</p>`,
  });
  return { subject: `Your request to the Guild, ${r.ref}`, text, html };
}

export function intakeAlert(r: RequestSummary, requestId: string): Email {
  const urgent = r.urgency === 'no-heat-or-water';
  const link = `${siteUrl()}/portal?tab=jobs&request=${requestId}`;
  const where = [r.zip, r.neighborhood].filter(Boolean).join(', ') || 'not given';
  const contact = [
    r.contactName,
    r.contactPhone,
    r.contactEmail,
    r.bestTime && `best time: ${r.bestTime}`,
  ]
    .filter(Boolean)
    .join(' / ');
  const text = `${urgent ? 'URGENT. ' : ''}New help request ${r.ref}

Help with: ${r.trade}
How urgent: ${URGENCY_LABEL[r.urgency] ?? r.urgency}
Where: ${where}
Contact: ${contact}
Photos: ${r.photoCount}

${r.description}

Open it on the job board: ${link}${textFooter()}`;
  const html = shell({
    title: `${urgent ? 'Urgent: ' : ''}New help request ${r.ref}`,
    bodyHtml: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:16px;line-height:1.5;color:#2b2624">
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">Help with</td><td>${escapeHtml(r.trade)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">How urgent</td><td style="${urgent ? 'color:#8c3a2e;font-weight:700' : ''}">${escapeHtml(URGENCY_LABEL[r.urgency] ?? r.urgency)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">Where</td><td>${escapeHtml(where)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">Contact</td><td>${escapeHtml(contact)}</td></tr>
        <tr><td style="padding:2px 16px 2px 0;color:#6e6560">Photos</td><td>${r.photoCount}</td></tr>
      </table>
      <div style="margin:16px 0;padding:12px 16px;border-left:4px solid #b08d57;background:#efeae4">${paragraphs(r.description)}</div>
      ${button(link, 'Open on the job board')}`,
  });
  return { subject: `${urgent ? 'Urgent: ' : ''}New request ${r.ref}: ${r.trade}`, text, html };
}

export function requesterNote(
  r: { ref: string },
  note: string,
  trackingToken: string | null,
): Email {
  const link = trackingToken ? `${siteUrl()}/request/track/${trackingToken}` : null;
  const replyLine = link
    ? `Reply on the tracking page: ${link}`
    : 'To reply, open the private link from your confirmation email.';
  const text = `A Guild member added a note to your request ${r.ref}:

${note}

${replyLine}${textFooter()}`;
  const html = shell({
    title: `A note on your request ${r.ref}`,
    bodyHtml: `<div style="margin:0 0 16px 0;padding:12px 16px;border-left:4px solid #b08d57;background:#efeae4">${paragraphs(note)}</div>${link ? button(link, 'Reply on the tracking page') : paragraphs(replyLine)}`,
  });
  return { subject: `A note on your request ${r.ref}`, text, html };
}

export function memberNoteAlert(
  r: { ref: string; contactName: string },
  note: string,
  requestId: string,
): Email {
  const link = `${siteUrl()}/portal?tab=jobs&request=${requestId}`;
  const text = `${r.contactName} added a note to request ${r.ref}:

${note}

Open it: ${link}${textFooter()}`;
  const html = shell({
    title: `New note on ${r.ref}`,
    bodyHtml: `<p style="margin:0 0 12px 0;font-size:16px;color:#2b2624">From ${escapeHtml(r.contactName)}:</p><div style="margin:0 0 16px 0;padding:12px 16px;border-left:4px solid #b08d57;background:#efeae4">${paragraphs(note)}</div>${button(link, 'Open on the job board')}`,
  });
  return { subject: `New note on ${r.ref} from ${r.contactName}`, text, html };
}
