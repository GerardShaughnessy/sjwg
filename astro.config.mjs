// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// BACKEND: when a real domain exists, set `site` to it so canonical URLs and the sitemap are correct.
export default defineConfig({
  site: 'https://sjwg.netlify.app',
  output: 'static',
  integrations: [react(), sitemap({ filter: (page) => !/\/(portal|login)\/?$/.test(page) })],
  vite: {
    plugins: [tailwindcss()],
  },
});
