/**
 * Captures the homepage's feature screenshots from the real app.
 *
 *   npm run build && npx astro preview --port 4399
 *   npm i --no-save playwright && node scripts/capture-app-shots.mjs
 *
 * Writes public/shots/*.jpg at 2x. Everything shown is the sample project,
 * so every name and quote in the shots is invented. Each shot is clipped to a
 * 16:10 region around its subject, leaving out the sidebar, the top bar and
 * most of the empty canvas, so it stays legible at phone width.
 */
import { chromium } from 'playwright';

const BASE = process.env.CANON_URL ?? 'http://localhost:4399/canon/app/';
const OUT = new URL('../public/shots/', import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('canon-name', 'James M.'));
const p = await ctx.newPage();
// A 16:10 clip, in CSS px, from its left, top and width.
const clip = (x, y, width) => ({ x, y, width, height: Math.round((width * 10) / 16) });
const shot = async (name, region) => {
  await p.addStyleTag({ content: '.toast,.store-cta,.account{display:none!important}' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 84, clip: region });
  console.log('wrote', name);
};

await p.goto(BASE);
await p.click('text=Try the sample project');
await p.waitForSelector('.lib-card');
await p.waitForTimeout(1800);
// The prototype grid, from the filter bar down past the Today ring stack.
await shot('library', clip(256, 60, 1176));

await p.click('.rail-sub a:has-text("Explorations")');
await p.waitForSelector('.frame.multi');
await p.waitForTimeout(1500);
await p.locator('.pin.comment').first().dispatchEvent('pointerdown');
await p.waitForSelector('.thread');
// The open note, the phone it is pinned to, and its neighbours.
await shot('comments', clip(300, 95, 760));
await p.keyboard.press('Escape');

await p.locator('.frame.multi .frame-body').click({ position: { x: 200, y: 150 } });
await p.waitForSelector('.links');
await p.waitForTimeout(1500);
await p.locator('[data-page="pricing.html"] .frame-body').click({ position: { x: 40, y: 40 } });
await p.waitForTimeout(800);
// The page map and the inspector with its links.
await shot('map', clip(304, 60, 1136));

await browser.close();
