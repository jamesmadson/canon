/**
 * Renders the /hero-b/ page (the homepage with the scattered hero) to HTML,
 * the way renderHome.mjs renders the homepage.
 *
 *   node tests/helpers/renderHeroB.mjs
 */
import { createServer } from 'vite';
import { getViteConfig } from 'astro/config';

const config = await getViteConfig({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })({
  command: 'serve',
  mode: 'development',
});
const server = await createServer({ ...config, configFile: false });
try {
  const { experimental_AstroContainer: AstroContainer } = await server.ssrLoadModule('astro/container');
  const page = await server.ssrLoadModule('/src/pages/hero-b.astro');
  const container = await AstroContainer.create();
  const html = await container.renderToString(page.default, { request: new Request('http://localhost/canon/hero-b/') });
  process.stdout.write('\u0001' + html.replace(/ data-astro-source-(file|loc)="[^"]*"/g, ''));
} finally {
  await server.close();
}
