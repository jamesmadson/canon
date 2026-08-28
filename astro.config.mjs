import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jamesmadson.github.io',
  base: '/canon',
  // Dev-only: honor an assigned PORT (e.g. from the editor's preview runner)
  // so parallel worktrees don't fight over 4321. No effect on builds.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  integrations: [mdx()],
  // The skill briefly shipped as "dieter"; keep the old URL landing somewhere.
  redirects: { '/skills/dieter': '/canon/skills/deter/' },
  vite: {
    plugins: [tailwindcss()],
  },
});
