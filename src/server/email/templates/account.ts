import { siteUrl } from '../../env';
import { button, escapeHtml, paragraphs, shell, textFooter, type Email } from '../layout';

export function memberInvitation(opts: {
  name: string;
  invitedBy: string;
  role: 'admin' | 'member';
  token: string;
}): Email {
  const link = `${siteUrl()}/invite/${opts.token}`;
  const roleLine =
    opts.role === 'admin'
      ? 'as a Guild officer, with access to everything in the portal'
      : 'as a Guild member';
  const greeting = opts.name ? `${opts.name},` : 'Hello,';
  const body = `${opts.invitedBy} invited you to the St. Joseph the Worker Guild portal ${roleLine}.

Open the link below to set your password. It works for seven days and only for this email address.`;
  const text = `${greeting}

${body}

${link}

If you were not expecting this, ignore it and nothing happens.${textFooter()}`;
  const html = shell({
    title: 'You are invited to the Guild portal',
    bodyHtml: `${paragraphs(`${greeting}\n\n${body}`)}${button(link, 'Set your password')}<p style="margin:0;font-size:14px;color:#6e6560">If you were not expecting this, ignore it and nothing happens.</p>`,
  });
  return { subject: 'Your invitation to the Guild portal', text, html };
}

export function passwordReset(link: string): Email {
  const body = `Someone asked to reset the password for this Guild portal account. Open the link to set a new one. It works for 15 minutes.

If you did not ask for this, ignore it. Your password stays as it is.`;
  return {
    subject: 'Reset your Guild portal password',
    text: `${body}\n\n${link}${textFooter()}`,
    html: shell({
      title: 'Reset your password',
      bodyHtml: `${paragraphs(body)}${button(link, 'Set a new password')}`,
    }),
  };
}

export function formNotification(kind: string, fields: Record<string, string>): Email {
  const label =
    { contact: 'Contact form', partner: 'Partnership inquiry', membership: 'Membership interest' }[
      kind
    ] ?? kind;
  const lines = Object.entries(fields)
    .filter(([k, v]) => k !== 'website' && v)
    .map(
      ([k, v]) => [k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), v] as const,
    );
  const text = `${label} from the website\n\n${lines.map(([k, v]) => `${k}: ${v}`).join('\n')}${textFooter()}`;
  const html = shell({
    title: `${label} from the website`,
    bodyHtml: `<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:16px;line-height:1.5;color:#2b2624">${lines
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#6e6560;vertical-align:top">${escapeHtml(k)}</td><td>${escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`,
      )
      .join('')}</table>`,
  });
  return { subject: `${label}: ${fields.name ?? ''}`.trim(), text, html };
}
