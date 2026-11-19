/**
 * Renders the homepage component to HTML with the Astro container and prints
 * it. The tests run this in a child process, because the Astro compiler needs
 * its own Vite server and does not run inside Vitest.
 *
 *   node tests/helpers/renderHome.mjs [waitlist url] [scatter or terminal]
 */
import { createServer } from 'vite';
import { getViteConfig } from 'astro/config';

const waitlistUrl = process.argv[2] ?? '';
const hero = process.argv[3] ?? 'scatter';
const config = await getViteConfig({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })({
  command: 'serve',
  mode: 'development',
});
const server = await createServer({ ...config, configFile: false });
try {
  const { experimental_AstroContainer: AstroContainer } = await server.ssrLoadModule('astro/container');
  const page = await server.ssrLoadModule('/src/components/home/HomePage.astro');
  const container = await AstroContainer.create();
  const html = await container.renderToString(page.default, { props: { waitlistUrl, hero } });
  // The dev compiler stamps each element with where it came from. Leave that out.
  process.stdout.write('\u0001' + html.replace(/ data-astro-source-(file|loc)="[^"]*"/g, ''));
} finally {
  await server.close();
}
