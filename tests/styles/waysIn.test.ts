import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const flat = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');

let html = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderPage.mjs', 'index'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  html = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

const ways = () => html.slice(html.indexOf('id="projects"'), html.indexOf('id="agents"'));

describe('the tools band', () => {
  it('sits between the hero and the first section, with the new copy', () => {
    const band = html.slice(html.indexOf('id="tools"'), html.indexOf('id="projects"'));
    expect(html.indexOf('id="tools"')).toBeGreaterThan(html.indexOf('data-scatter'));
    expect(flat(band)).toContain('New tools every month. One place for the work.');
    expect(flat(band)).toContain('Your team tries whatever launched this week, across every project. Canon files it all beside the rest, so you never have to remember which tool a prototype lives in.');
    expect(band).not.toMatch(/[–—]/);
  });

  it('keeps the hero lede to one line', () => {
    expect(read('src/components/home/HeroText.astro')).toContain('Links, zips and agent builds, filed by project on your machine.');
  });
});

describe('the ways in logos', () => {
  it('shows marks with their names for the agents and the link sources', () => {
    const w = ways();
    const items = [...w.matchAll(/<li class="mk[^"]*">([\s\S]*?)<\/li>/g)].map((m) => m[1]);
    const withMark = items.filter((i) => i.includes('<svg'));
    const names = (list: string[]) => list.map((i) => flat(i).trim());
    expect(names(withMark)).toEqual(['Claude Code', 'Cursor', 'Figma', 'v0', 'Replit', 'GitHub Pages']);
    // Brands with no mark in Simple Icons are plain name chips, not made-up logos.
    expect(names(items.filter((i) => !i.includes('<svg')))).toEqual(['Codex', 'Lovable', 'Bolt', 'Zip file', 'Folder']);
    for (const i of withMark) {
      expect(i).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(i).toMatch(/<path d="[^"]{20,}"/);
    }
    expect(w.match(/<ul class="marks" role="list" aria-label="[^"]+"/g)).toHaveLength(3);
  });

  it('draws the marks in one colour and loads nothing at run time', () => {
    const list = read('src/components/home/BrandList.astro');
    expect(list).toContain('fill="currentColor"');
    expect(list).not.toMatch(/https?:|<img|fetch\(/);
    expect(read('src/lib/brandMarks.ts')).not.toMatch(/import |https?:\/\/(?!simpleicons)/);
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.devDependencies['simple-icons']).toBeTruthy();
    expect(pkg.dependencies?.['simple-icons']).toBeUndefined();
  });

  it('keeps each card to a title and one short sentence', () => {
    const cards = [...ways().matchAll(/<div class="tx2">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)];
    expect(cards).toHaveLength(3);
    for (const c of cards) expect(flat(c[2]).trim().split(' ').length, c[2]).toBeLessThanOrEqual(12);
    expect(ways()).not.toMatch(/Live switch|stored copy that/);
  });

  it('matches the first card’s terminal to the hero’s, smaller, and draws the zip being dropped', () => {
    const w = ways();
    expect(w).toContain('class="pterm pmini"');
    expect(w).toContain('class="pinput"');
    expect(w).not.toContain('pcaret');
    expect(w).toContain('class="zfile"');
    expect(w).toContain('settings-new.zip');
    expect(w).not.toContain('dropz');
  });
});
