import { siteUrl } from '../../env';
import { button, escapeHtml, paragraphs, shell, textFooter, type Email } from '../layout';

const boardLink = (id?: string) => `${siteUrl()}/portal?tab=tasks${id ? `&task=${id}` : ''}`;

function longDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** One task handed to an officer by another officer. */
export function taskAssigned(o: {
  id: string;
  title: string;
  notes: string;
  section: string;
  dueDate: string;
  assignedBy: string;
  name: string;
}): Email {
  const link = boardLink(o.id);
  const due = o.dueDate ? `Due ${longDate(o.dueDate)}.` : '';
  const intro = `${o.assignedBy} assigned you a task on the Guild board (${o.section}).${due ? ` ${due}` : ''}`;
  const greeting = o.name ? `${o.name},` : 'Hello,';
  const text = `${greeting}

${intro}

${o.title}
${o.notes ? `\n${o.notes}\n` : ''}
Open the board: ${link}${textFooter()}`;
  const html = shell({
    title: o.title,
    bodyHtml: `${paragraphs(`${greeting}\n\n${intro}`)}${o.notes ? `<div style="border-left:3px solid #b08d57;padding:4px 0 4px 14px;margin:0 0 8px 0">${paragraphs(o.notes)}</div>` : ''}${button(link, 'Open the task')}`,
  });
  return { subject: `Task for you: ${o.title}`, text, html };
}

/** Several tasks handed over at once, as one email instead of one each. */
export function tasksAssignedDigest(o: {
  titles: string[];
  assignedBy: string;
  name: string;
}): Email {
  const link = boardLink();
  const n = o.titles.length;
  const greeting = o.name ? `${o.name},` : 'Hello,';
  const intro = `${o.assignedBy} put ${n} ${n === 1 ? 'task' : 'tasks'} in your name on the Guild board:`;
  const text = `${greeting}

${intro}

${o.titles.map((t) => `- ${t}`).join('\n')}

Open the board: ${link}${textFooter()}`;
  const html = shell({
    title: `${n} ${n === 1 ? 'task' : 'tasks'} for you`,
    bodyHtml: `${paragraphs(`${greeting}\n\n${intro}`)}<ul style="margin:0 0 8px 0;padding-left:22px;font-size:17px;line-height:1.55;color:#2b2624">${o.titles.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>${button(link, 'Open the board')}`,
  });
  return { subject: `${n} ${n === 1 ? 'task' : 'tasks'} for you on the Guild board`, text, html };
}
