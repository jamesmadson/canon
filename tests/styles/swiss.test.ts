import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const css = read('src/components/home/HomeStyles.astro');

let html = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderHome.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  html = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

describe('the page grid', () => {
  it('puts every section on one 12-column grid with 20px gutters and a hairline above it', () => {
    expect(css).toMatch(/\.band \{[^}]*grid-template-columns: repeat\(12, minmax\(0, 1fr\)\)[^}]*column-gap: 20px[^}]*border-top: 1px solid var\(--color-rule\)/);
    expect(css).toMatch(/\.band \{[^}]*padding: 24px 0 96px/);
    expect(css).toMatch(/\.band > \.bhead \{[^}]*grid-column: 1 \/ span 6[^}]*margin-bottom: 32px/);
  });

  it('gives each section a head with the title and the lede under it', () => {
    for (const id of ['projects', 'agents', 'find', 'open', 'hosted']) {
      const sec = html.slice(html.indexOf(`id="${id}"`));
      expect(sec.slice(0, sec.indexOf('</h2>'))).toContain('class="bhead"');
    }
    expect(html.match(/class="band/g)).toHaveLength(5);
  });

  it('sets the head in the left four columns and the picture in the right eight for search', () => {
    expect(html).toContain('class="band split" id="find"');
    expect(css).toMatch(/\.band\.split > \.bhead \{\s*grid-column: 1 \/ span 4/);
    expect(css).toMatch(/\.band\.split > \.bbody \{\s*grid-column: 5 \/ -1/);
  });

  it('sets section titles at 24/30 and weight 400, and the hero title at 48/52', () => {
    expect(css).toMatch(/\.home h2 \{\s*font-size: 24px;\s*line-height: 30px;\s*font-weight: 400/);
    expect(css).toMatch(/\.home h1 \{\s*font-size: 48px;\s*line-height: 52px/);
  });
});

describe('the ways in cards', () => {
  it('number the three cards 1, 2 and 3 in a 20px ring that is not orange', () => {
    const ways = html.slice(html.indexOf('id="projects"'), html.indexOf('id="agents"'));
    expect([...ways.matchAll(/<span class="num" aria-hidden="true">(\d)<\/span>/g)].map((m) => m[1])).toEqual(['1', '2', '3']);
    const num = css.match(/\.num \{[^}]*\}/)![0];
    expect(num).toMatch(/width: 20px/);
    expect(num).toMatch(/height: 20px/);
    expect(num).not.toMatch(/orange|ff4f00|b83a00/i);
  });

  it('list their tools as quiet muted lines', () => {
    const ways = html.slice(html.indexOf('id="projects"'), html.indexOf('id="agents"'));
    expect(ways.match(/<ul class="srcs">/g)).toHaveLength(3);
    expect(ways).toContain('<li>Claude Code</li>');
    expect(css).toMatch(/\.srcs \{[^}]*color: var\(--color-ink-soft\)/);
  });
});

describe('D-133 still holds', () => {
  it('draws rounded panels without borders', () => {
    for (const sel of ['\\.panel', '\\.tint', '\\.read']) {
      const rule = css.match(new RegExp(`\\n  ${sel} \\{[^}]*\\}`))![0];
      expect(rule).not.toMatch(/\bborder:/);
    }
  });
});
