import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const page = (name: string) => {
  const out = execFileSync('node', ['tests/helpers/renderPage.mjs', name], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  return out.slice(out.indexOf('\u0001') + 1);
};
const flat = (s: string) => s.replace(/ /g, ' ');

let home = '';
let heroA = '';
let heroC = '';
let heroD = '';
beforeAll(() => {
  home = page('index');
  heroA = page('hero-a');
  heroC = page('hero-c');
  heroD = page('hero-d');
}, 240_000);

const text = (html: string) => html.slice(html.indexOf('class="htext"'), html.indexOf('class="hpanel"'));

describe('the two hidden hero concepts', () => {
  it('are kept out of search, and linked from nowhere', () => {
    for (const html of [heroC, heroD]) expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    // Not in the homepage, the earlier hero, the nav, the footer, any other page or any sitemap.
    for (const html of [home, heroA]) expect(html).not.toMatch(/hero-[cd]/);
    const files: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(join(root, d))) {
        const p = `${d}/${n}`;
        if (statSync(join(root, p)).isDirectory()) walk(p);
        else if (/\.(astro|ts|mdx|md|xml|json)$/.test(n)) files.push(p);
      }
    };
    walk('src');
    walk('public');
    for (const f of files) {
      // The two pages themselves, and the nav's list of pages that count as the homepage (it links nothing).
      if (f === 'src/pages/hero-c.astro' || f === 'src/pages/hero-d.astro' || f === 'src/components/home/SectionNav.astro') continue;
      expect(read(f), f).not.toMatch(/(href|url|loc|redirects)[^\n]*hero-[cd]/i);
    }
    expect(read('astro.config.mjs')).not.toMatch(/sitemap/);
  });

  it('keep the hero text block, both buttons and the Try the MCP panel exactly as on the homepage', () => {
    expect(text(heroC)).toBe(text(home));
    expect(text(heroD)).toBe(text(home));
    expect(text(home)).toContain('Try the MCP');
  });

  it('hold a decorative, hidden stage with no layout of their own that can scroll sideways', () => {
    for (const [html, variant] of [[heroC, 'cards'], [heroD, 'tabs']] as const) {
      expect(html).toContain(`aria-hidden="true" data-scatter data-variant="${variant}"`);
      expect(html).not.toContain('data-prompt');
    }
    const css = read('src/components/home/HeroVariantStyles.astro');
    expect(css).toContain('clip-path: inset(-700px -50vw 0 -50vw)');
    expect(read('src/components/home/HomeStyles.astro')).toMatch(/overflow-x: clip/);
  });

  it('draw 30 or more tabs and one Canon tab in hero-d, and cards past the edges in hero-c', () => {
    expect(heroD.match(/class="btab"/g)!.length).toBeGreaterThanOrEqual(30);
    expect(heroD.match(/class="btab canon-tab"/g)).toHaveLength(1);
    expect(heroD).toContain('Checkout v3 · Lovable');
    expect(heroD).toContain('Onboarding final FINAL');
    expect(read('src/components/home/HeroVariantStyles.astro')).toContain('.btab:nth-child(n + 13):not(.canon-tab)');
    expect(heroC.match(/class="xcard/g)!.length).toBeGreaterThanOrEqual(9);
    expect(read('src/scripts/scatter.ts')).toMatch(/CARDS_WIDE[\s\S]*\[-0\.1,[\s\S]*\[1\.07,/);
  });

  // Mutation: add a left, top, width, height or margin transition, or another curve.
  it('animate only transform and opacity, on the one curve', () => {
    const css = read('src/components/home/HeroVariantStyles.astro');
    const decls = [...css.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1]);
    expect(decls.length).toBeGreaterThan(3);
    for (const d of decls) {
      for (const part of d.split(/,(?![^(]*\))/)) {
        const [prop, dur, curve] = part.trim().replace(/cubic-bezier\(([^)]*)\)/, 'cubic-bezier($1)').split(/\s+(?![^(]*\))/);
        if (prop === 'none') continue;
        expect(prop).toMatch(/^(transform|opacity)$/);
        expect(Number.parseInt(dur)).toBeLessThanOrEqual(400);
        expect(curve).toBe('cubic-bezier(0.2, 0, 0, 1)');
      }
    }
    expect(css).not.toMatch(/animation:|@keyframes/);
  });

  // Mutation: drop the reduced motion block, or make the first frame the start state in the markup's own styles.
  it('show the final state without script and with reduced motion, and pause off screen and in a hidden tab', () => {
    const css = read('src/components/home/HeroVariantStyles.astro');
    expect(css).toMatch(/\.xcard \{[^}]*opacity: 0/);
    expect(css).toMatch(/\.btab:not\(\.canon-tab\) \.btab-in \{\s*opacity: 0/);
    expect(css).toMatch(/\.sstage\.live:not\(\.is-filed\) \.canon-tab \.btab-in/);
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.xcard \{\s*display: none !important/);
    expect(reduced).toMatch(/\.canon-tab \.btab-in \{\s*opacity: 1 !important/);
    const script = read('src/scripts/scatter.ts');
    expect(script).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(script).toContain('document.hidden');
    expect(script).toContain('IntersectionObserver');
    expect(script).toMatch(/forced === 'filed' \? 'filed' : forced === 'scattered' \|\| forced === 'start'/);
    // The states only exist once the page has marked itself as scripted.
    expect(css).not.toMatch(/\n  \.hero-[cd] \.scard \{[^}]*opacity: 0/);
  });
});
