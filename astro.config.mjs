import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://jamesmadson.github.io',
  base: '/canon',
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
