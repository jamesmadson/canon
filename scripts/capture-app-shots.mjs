/**
 * Captures the homepage's feature screenshots from the real app.
 *
 *   npm run build && npx astro preview --port 4399
 *   npm i --no-save playwright && node scripts/capture-app-shots.mjs
 *
 * Writes public/shots/*.jpg at 2x. Everything shown is the sample project,
 * so every name and quote in the shots is invented.
 */
import { chromium } from 'playwright';

const BASE = process.env.CANON_URL ?? 'http://localhost:4399/canon/app/';
const OUT = new URL('../public/shots/', import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('canon-name', 'James M.'));
const p = await ctx.newPage();
const shot = async (name) => {
  await p.addStyleTag({ content: '.toast{display:none!important}' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}${name}.jpg`, type: 'jpeg', quality: 84 });
  console.log('wrote', name);
};

await p.goto(BASE);
await p.click('text=Try the sample project');
await p.waitForSelector('.lib-card');
await p.waitForTimeout(1800);
await shot('library');

await p.click('.rail-sub a:has-text("Explorations")');
await p.waitForSelector('.frame.multi');
await p.waitForTimeout(1500);
await p.locator('.frame.multi').hover({ position: { x: 220, y: 160 } });
await p.waitForSelector('.tease');
await p.waitForTimeout(1200);
await shot('board');

await p.mouse.move(5, 5);
await p.locator('.pin.comment').first().dispatchEvent('pointerdown');
await p.waitForSelector('.thread');
await shot('comments');
await p.keyboard.press('Escape');

await p.locator('.frame.multi .frame-body').click({ position: { x: 200, y: 150 } });
await p.waitForSelector('.links');
await p.waitForTimeout(1500);
await p.locator('[data-page="pricing.html"] .frame-body').click({ position: { x: 40, y: 40 } });
await p.waitForTimeout(800);
await shot('map');

await browser.close();
