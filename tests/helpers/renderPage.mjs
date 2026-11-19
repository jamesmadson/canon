/**
 * Renders a whole page (layout, header, footer) to HTML, the way renderHome.mjs
 * renders the homepage component.
 *
 *   node tests/helpers/renderPage.mjs index        the homepage, at /
 *   node tests/helpers/renderPage.mjs hero-a       the earlier terminal hero
 */
import { createServer } from 'vite';
import { getViteConfig } from 'astro/config';

const name = process.argv[2] ?? 'index';
const config = await getViteConfig({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })({
  command: 'serve',
  mode: 'development',
});
const server = await createServer({ ...config, configFile: false });
try {
  const { experimental_AstroContainer: AstroContainer } = await server.ssrLoadModule('astro/container');
  const page = await server.ssrLoadModule(`/src/pages/${name}.astro`);
  const container = await AstroContainer.create();
  const html = await container.renderToString(page.default, { request: new Request(name === 'index' ? 'http://localhost/canon/' : `http://localhost/canon/${name}/`) });
  process.stdout.write('\u0001' + html.replace(/ data-astro-source-(file|loc)="[^"]*"/g, ''));
} finally {
  await server.close();
}
