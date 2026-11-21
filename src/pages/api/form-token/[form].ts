import type { APIRoute } from 'astro';
import { json, notFound, route } from '@/server/http';
import { issueFormToken } from '@/server/spam';

export const prerender = false;

const FORMS = new Set(['directory', 'aid']);

/** A fresh signed token for a form that just opened. */
export const GET: APIRoute = route(async (ctx) => {
  const form = ctx.params.form ?? '';
  if (!FORMS.has(form)) throw notFound();
  return json({ token: issueFormToken(form) });
});
