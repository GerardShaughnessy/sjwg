import { siteUrl } from '../../env';
import { button, escapeHtml, paragraphs, shell, textFooter, type Email } from '../layout';

const boardLink = (id?: string) => `${siteUrl()}/portal?tab=tasks${id ? `&task=${id}` : ''}`;

function longDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** One task handed to someone, with its notes. Kept for a direct, one-off send. */
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
    bodyHtml: `${paragraphs(`${greeting}\n\n${intro}`)}${o.notes ? `<div style="border-left:3px solid #a37820;padding:4px 0 4px 14px;margin:0 0 8px 0">${paragraphs(o.notes)}</div>` : ''}${button(link, 'Open the task')}`,
  });
  return { subject: `Task for you: ${o.title}`, text, html };
}

export interface BatchItem {
  id: string;
  title: string;
  dueDate: string;
  /** Who put them on it. Empty when unknown. */
  assignedBy: string;
}

/** "Due Monday, December 1. From Greg." */
function itemLine(i: BatchItem): string {
  return [
    i.dueDate ? `Due ${longDate(i.dueDate)}.` : 'No due date.',
    i.assignedBy ? `From ${i.assignedBy}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The batched "new task" email, sent by the task-digest job about 15
 * minutes after the first assignment. One task reads as that task; several
 * read as "You have 5 new tasks", each with its own link.
 */
export function tasksAssignedBatch(o: { name: string; items: BatchItem[] }): Email {
  const greeting = o.name ? `${o.name},` : 'Hello,';
  const n = o.items.length;
  if (n === 1) {
    const i = o.items[0];
    const link = boardLink(i.id);
    const intro = `${i.assignedBy || 'An officer'} put you on a task on the Guild board.`;
    const text = `${greeting}

${intro}

${i.title}
${itemLine(i)}

Open the task: ${link}${textFooter()}`;
    const html = shell({
      title: i.title,
      bodyHtml: `${paragraphs(`${greeting}\n\n${intro}`)}<div style="border-left:3px solid #a37820;padding:4px 0 4px 14px;margin:0 0 8px 0">${paragraphs(`${i.title}\n${itemLine(i)}`)}</div>${button(link, 'Open the task')}`,
    });
    return { subject: `New task: ${i.title}`, text, html };
  }
  const intro = `You have ${n} new tasks on the Guild board:`;
  const text = `${greeting}

${intro}

${o.items.map((i) => `- ${i.title}\n  ${itemLine(i)}\n  ${boardLink(i.id)}`).join('\n\n')}

Open the board: ${boardLink()}${textFooter()}`;
  const html = shell({
    title: `You have ${n} new tasks`,
    bodyHtml: `${paragraphs(`${greeting}\n\n${intro}`)}<ul style="margin:0 0 8px 0;padding-left:22px;font-size:17px;line-height:1.55;color:#43402a">${o.items
      .map(
        (i) =>
          `<li style="margin-bottom:10px"><a href="${escapeHtml(boardLink(i.id))}" style="color:#7c2d1f;font-weight:600">${escapeHtml(i.title)}</a><br><span style="font-size:15px;color:#6b6450">${escapeHtml(itemLine(i))}</span></li>`,
      )
      .join('')}</ul>${button(boardLink(), 'Open the board')}`,
  });
  return { subject: `You have ${n} new tasks on the Guild board`, text, html };
}

/** The one email when a task is finished for the first time. Goes to hello@. */
export function taskFinished(o: { id: string; title: string; section: string; by: string }): Email {
  const link = boardLink(o.id);
  const line = `${o.by} finished ${o.title}.`;
  const text = `${line}

Section: ${o.section}

Open the task: ${link}${textFooter()}`;
  const html = shell({
    title: 'Task finished',
    bodyHtml: `${paragraphs(`${line}\n\nSection: ${o.section}`)}${button(link, 'Open the task')}`,
  });
  return { subject: `${o.by} finished ${o.title}`, text, html };
}
