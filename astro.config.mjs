// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

/** Routes that are private or per-visitor and must stay out of the sitemap. */
const PRIVATE =
  /\/(portal|login|forgot-password|reset-password|invite|request\/track|donate\/thank-you|api)(\/|$)/;

// When a real domain exists, set `site` so canonical URLs and the sitemap are correct.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL?.startsWith('https://')
    ? process.env.PUBLIC_SITE_URL
    : 'https://sjwg.netlify.app',
  // Public pages are prerendered. Routes that export `prerender = false`
  // (portal, auth, api) run on demand in one Netlify function.
  output: 'static',
  adapter: netlify({ imageCDN: false }),
  integrations: [react(), sitemap({ filter: (page) => !PRIVATE.test(page) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
