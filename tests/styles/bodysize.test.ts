import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const css = readFileSync(join(root, 'src/components/home/HomeStyles.astro'), 'utf8');

let html = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderHome.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  html = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

describe('body text one step larger', () => {
  it('sets the hero lede at 20/30 and section ledes at 18/28', () => {
    expect(css).toMatch(/\.home \.lede \{\s*font-size: 18px;\s*line-height: 28px/);
    expect(css).toMatch(/\.home \.lede\.lede-hero \{\s*font-size: 20px;\s*line-height: 30px/);
    expect(html).toContain('class="lede lede-hero');
  });

  it('sets card body copy at 16/26 and keeps lines under 68 characters', () => {
    expect(css).toMatch(/\.panel \.tx2 p \{[^}]*font-size: 16px;\s*line-height: 26px/);
    expect(css).toMatch(/\.plans li \{\s*font-size: 16px/);
    const widths = [...css.matchAll(/\.(?:htext \.lede|bhead \.lede|after \.fine) \{[^}]*max-width: (\d+)ch/g)].map((m) => Number(m[1]));
    expect(widths.length).toBeGreaterThanOrEqual(3);
    for (const w of widths) expect(w).toBeLessThan(68);
  });

  it('leaves meta lines and labels as they were', () => {
    expect(css).toMatch(/\n  \.fine \{[^}]*font-size: 13px/);
    expect(css).toMatch(/\.say \{[^}]*font-size: 14px/);
  });
});
