import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const app = read('src/app/app.css');
const global = read('src/styles/global.css');
const home = read('src/components/home/HomeStyles.astro');

/** The first plain rule for a selector, as written: `selector {` to the next brace. */
const rule = (css: string, selector: string) => {
  const m = new RegExp(`^ *${selector.replace(/[.[\]]/g, '\\$&')} \\{`, 'm').exec(css);
  expect(m, selector).toBeTruthy();
  return css.slice(m!.index, css.indexOf('}', m!.index));
};
const radius = (r: string) => /border-radius: ([^;]+);/.exec(r)?.[1].trim();

describe('every button is a pill', () => {
  it('has one radius token for buttons, in the app and on the site', () => {
    expect(app).toMatch(/--r-btn: 999px;/);
    expect(global).toMatch(/--radius-btn: 999px;/);
  });

  it('gives the app’s button classes that token and no radius of their own', () => {
    for (const sel of ['.btn', '.ibtn', '.util', '.add', '.st', '.gbtn', '.find', '.store-tools button', '.foot-links button', '.switcher .sw-more button']) {
      expect(radius(rule(app, sel)), sel).toBe('var(--r-btn)');
    }
    expect(radius(rule(app, '.btn.primary'))).toBeUndefined();
  });

  it('gives the site’s four shared button classes, and the home page’s, that token', () => {
    for (const sel of ['.btn-primary', '.btn-secondary', '.btn-utility', '.btn-quiet']) expect(radius(rule(global, sel)), sel).toBe('var(--radius-btn)');
    for (const sel of ['.hbtn', '.util']) expect(radius(rule(home, sel)), sel).toBe('var(--radius-btn)');
  });

  it('keeps squared corners on what is not a button', () => {
    expect(radius(rule(app, '.seg'))).toBe('var(--r-md)');
    expect(radius(rule(app, '.dialog'))).toBe('14px');
    expect(radius(rule(app, '.setup'))).toBe('var(--r-md)');
    expect(radius(rule(app, '.tabs a'))).toBe('var(--r-md)');
  });

  it('pads a pill by at least half its height on each side', () => {
    const pad = (css: string, sel: string, h: number) => {
      const m = /padding: 0 (\d+)px(?: \d+px)?[ ;]|padding-inline: (\d+)px/.exec(rule(css, sel));
      expect(m, sel).toBeTruthy();
      return Number(m![1] ?? m![2]) >= h / 2;
    };
    expect(pad(app, '.util', 28)).toBe(true);
    expect(pad(app, '.add', 28)).toBe(true);
    expect(pad(app, '.find', 32)).toBe(true);
    expect(pad(home, '.hbtn', 38)).toBe(true);
    expect(pad(home, '.hbtn-small', 36)).toBe(true);
    expect(pad(home, '.util', 32)).toBe(true);
    expect(pad(global, '.btn', 44)).toBe(true);
  });
});
