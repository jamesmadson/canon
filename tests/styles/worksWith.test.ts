import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('the works with row', () => {
  const src = read('src/components/home/WorksWith.astro');

  it('uses exactly the tested names, in three labelled lists', () => {
    for (const name of ['Lovable', 'Figma Make', 'Framer', 'v0', 'Bolt', 'Replit', 'GitHub Pages', 'Vercel', 'Netlify', 'Claude Code', 'Codex', 'Cursor', 'a zip', 'a folder']) {
      expect(src).toContain(`'${name}'`);
    }
    for (const label of ['Paste a link from', 'Add with your agent', 'Or drop']) expect(src).toContain(label);
    expect(src).toContain('<ul class="ww-list" role="list" aria-labelledby={g.id}>');
  });

  it('has no logos, images, icons or brand colours', () => {
    const markup = src.split('<style')[0];
    expect(markup).not.toMatch(/<img|<svg|<picture/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('is static: no scrolling, cycling or animation', () => {
    expect(src).not.toMatch(/overflow-x|animation|transition|@keyframes|<script/);
  });

  it('sits between the hero and the first section', () => {
    const page = read('src/components/home/HomePage.astro');
    expect(page.indexOf('<WorksWith />')).toBeGreaterThan(page.indexOf('<HeroScatter'));
    expect(page.indexOf('<WorksWith />')).toBeLessThan(page.indexOf('<WaysIn />'));
  });

  it('balances the framing note, so its second line is never just "as a zip."', () => {
    expect(src).toMatch(/\.home \.ww-note \{[^}]*text-wrap: balance/);
  });

  it('carries the framing note, and the hero lede says deployments', () => {
    expect(src).toContain('v0 links work once the project is deployed. Claude artifacts and Webflow staging sites do not allow framing, so add those as a zip.');
    const hero = read('src/components/home/HeroText.astro');
    expect(hero).toContain('v0 deployments');
    expect(hero).not.toContain('v0 previews');
  });
});

describe('the hosted section', () => {
  it('keeps "under MIT." together and gives the email field at least 260px beside its button', () => {
    expect(read('src/components/home/Plans.astro')).toContain('under\u00a0MIT.');
    expect(read('src/components/home/HomeStyles.astro')).toMatch(/grid-template-columns: minmax\(260px, 1fr\) auto/);
  });
});
