import { DRAFT_NOTICE } from '@/config/documents/types';
import { button, escapeHtml, paragraphs, shell, textFooter, type Email } from '../layout';

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function signRequestEmail(opts: {
  signerName: string;
  title: string;
  sentBy: string;
  link: string;
  expiresOn: string;
  draft: boolean;
}): Email {
  const greeting = `${firstName(opts.signerName)},`;
  const draftLine = opts.draft ? `\n\n${DRAFT_NOTICE} This copy is for review and testing.` : '';
  const body = `${opts.sentBy} sent you the ${opts.title} from St. Joseph the Worker Guild to read and sign.

Open the link below to read it and sign with your typed name. It takes a few minutes. The link works until ${opts.expiresOn} and only for you, so please do not forward it.${draftLine}

When you sign, we will email you a PDF copy for your records. If you would rather sign on paper, reply to this email.`;
  return {
    subject: `Please sign: ${opts.title}`,
    text: `${greeting}\n\n${body}\n\n${opts.link}${textFooter()}`,
    html: shell({
      title: `Please sign the ${opts.title}`,
      bodyHtml: `${paragraphs(`${greeting}\n\n${body}`)}${button(opts.link, 'Read and sign')}<p style="margin:0;font-size:14px;color:#6b6450">Or paste this link into your browser: ${escapeHtml(opts.link)}</p>`,
    }),
  };
}

export function signedCopyEmail(opts: {
  signerName: string;
  title: string;
  signedAt: string;
  hasPdf: boolean;
}): Email {
  const body = `${opts.signerName} signed the ${opts.title} on ${opts.signedAt}.

${opts.hasPdf ? 'The signed copy is attached as a PDF. Keep it for your records.' : 'The signed copy could not be attached this time. The Guild has the signature on file and will send the PDF separately.'}

Questions? Write to hello@sjwg.org.`;
  return {
    subject: `Signed: ${opts.title}`,
    text: `${body}${textFooter()}`,
    html: shell({ title: `Signed: ${opts.title}`, bodyHtml: paragraphs(body) }),
  };
}
