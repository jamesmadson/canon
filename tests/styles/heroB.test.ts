import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

let html = '';
beforeAll(() => {
  const out = execFileSync('node', ['tests/helpers/renderHeroB.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  html = out.slice(out.indexOf('\u0001') + 1);
}, 120_000);

const stage = () => html.slice(html.indexOf('data-scatter'), html.indexOf('</section>', html.indexOf('data-scatter')));

describe('the scattered hero at /hero-b/', () => {
  it('is kept out of search results and carries the heading and both actions', () => {
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(html).toContain('Your prototypes are everywhere.');
    expect(html).toMatch(/Canon keeps them in one[\s\u00a0]place\./);
    expect(html).toMatch(/<a class="hbtn hbtn-primary" href="\/canon\/app\/">Open the app<\/a>/);
    expect(html).toMatch(/Connect your[\s\u00a0]agent/);
    expect(html).toContain('claude mcp add canon -- npx -y usecanon mcp');
    expect(html).not.toContain('class="term');
  });

  it('draws nine cards, each with a text chip naming where it lives', () => {
    const s = stage();
    expect(s.match(/data-card/g)).toHaveLength(9);
    const chips = [...s.matchAll(/<span class="[^"]*chip[^"]*"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(chips).toEqual(['Lovable', 'Claude Code', 'Figma Make', 'v0', 'Codex', 'Bolt', 'localhost:3000', 'mobile-sign-up.zip', 'Slack link']);
    for (const name of ['Onboarding', 'Dashboard', 'Mobile navigation']) expect(s).toContain(`<b>${name}</b>`);
    // Three rows of three, and no name long enough to be cut off.
    expect(s.match(/<div class="shelf">/g)).toHaveLength(3);
    for (const shelf of s.split('<div class="shelf">').slice(1)) expect(shelf.match(/data-card/g)).toHaveLength(3);
    expect(s).toContain('>Empty dashboard<');
    expect(s).not.toContain('with sample data');
  });

  it('has a decorative prompt that types the request and then shows the reply', () => {
    const box = html.slice(html.indexOf('class="pbox"'), html.indexOf('data-scatter'));
    expect(box).toContain('aria-hidden="true"');
    expect(box).toContain('data-prompt="Put all my prototypes in Canon, by project."');
    expect(box.replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/\s/g, '')).toContain('>Putallmyprototypesin Canon,byproject.'.replace(' ', ''));
    expect(box.match(/class="pc"/g)).toHaveLength('Put all my prototypes in Canon, by project.'.replaceAll(' ', '').length);
    expect(box).toContain('Claude Code');
    expect(box).toContain('canon_add  9 prototypes, 3 projects');
    expect(box).toContain('class="pcaret"');
    expect(box).not.toMatch(/<(a|button|input|select|textarea)\b|tabindex/);
  });

  it('is decorative: hidden from assistive tech, with nothing to focus', () => {
    const s = html.slice(html.indexOf('<div class="sstage"'));
    expect(s.slice(0, 80)).toContain('aria-hidden="true"');
    const inside = stage();
    expect(inside).not.toMatch(/<(a|button|input|select|textarea)\b|tabindex/);
  });

  it('has a texture panel whose picture is decorative, sized, self-hosted and base-aware', () => {
    const panel = html.slice(html.indexOf('class="hpanel"'), html.indexOf('class="pbox"'));
    const img = panel.match(/<img\b[^>]*>/)![0];
    expect(panel).toContain('aria-hidden="true"');
    expect(img).toContain('alt=""');
    expect(img).toContain('width="1920"');
    expect(img).toContain('height="1080"');
    expect(img).toContain('loading="eager"');
    expect(img).toContain('decoding="async"');
    expect(img).toContain('src="/canon/texture/hero-grain.webp"');
    expect(img).toContain('/canon/texture/hero-grain-960.webp 960w');
    expect(img).not.toMatch(/https?:/);
    expect(panel).toContain('class="hgrain"');
    expect(panel).toContain('url(/canon/texture/grain.png)');
    expect(statSync(join(root, 'public/texture/grain.png')).size).toBeGreaterThan(0);
    expect(statSync(join(root, 'public/texture/hero-grain.webp')).size).toBeLessThan(60 * 1024);
    expect(statSync(join(root, 'public/texture/hero-grain.webp')).size).toBeLessThan(120 * 1024);
    expect(statSync(join(root, 'public/texture/hero-grain-960.webp')).size).toBeLessThan(120 * 1024);
  });

  it('leaves the original hero as it was', () => {
    expect(read('src/pages/index.astro')).not.toContain('hero=');
    expect(read('src/components/home/HomePage.astro')).toContain("hero = 'terminal'");
  });
});

describe('the scattered hero styles and script', () => {
  const css = read('src/components/home/HeroScatter.astro');
  const script = read('src/scripts/scatter.ts');

  it('shows only the filed state with reduced motion, and the script does not start', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.sstage \.scard \{\s*transform: none !important/);
    expect(script).toContain("matchMedia('(prefers-reduced-motion: reduce)').matches");
  });

  it('animates only transform and opacity, on the site curves, between 100 and 400ms', () => {
    const rules = [...css.matchAll(/transition(?:-property)?:\s*([^;]+);/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const m of rules) {
      for (const part of m[1].split(/,(?![^(]*\))/)) {
        const [prop, , curve] = part.trim().split(/\s+/);
        if (prop === 'none') continue;
        expect(prop).toMatch(/^(transform|opacity)$/);
        expect(curve).toMatch(/^var\(--ease(-glide)?\)$/);
      }
    }
    // The one animation is the cursor's blink, which changes opacity only.
    expect([...css.matchAll(/@keyframes (\w+)/g)].map((m) => m[1])).toEqual(['pblink']);
    expect(css.match(/@keyframes pblink \{([\s\S]*?\n {2}\})/)![1]).not.toMatch(/transform|width|height|left|top|margin/);
    expect([...css.matchAll(/animation:/g)]).toHaveLength(1);
    // The prompt is shown whole, without its cursor, under reduced motion.
    expect(css).toMatch(/prefers-reduced-motion: reduce\) \{[\s\S]*?\.pbox \.pcaret \{\s*display: none !important/);
    // The cursor is the one place the box uses Canon orange.
    expect(css).toMatch(/\.pcaret \{[^}]*background: var\(--sel\)/);
    for (const m of css.matchAll(/(\d+)ms/g)) expect(Number(m[1]) >= 100 && Number(m[1]) <= 400, `${m[1]}ms`).toBe(true);
  });

  it('shows the filed state without script, and pauses when unseen', () => {
    expect(css).toMatch(/\.sstage\.live:not\(\.is-filed\)/);
    expect(css).not.toMatch(/\n  \.sstage \.scard \{[^}]*rotate/);
    expect(script).toContain('new IntersectionObserver');
    expect(script).toContain("document.addEventListener('visibilitychange'");
    expect(script).toContain(".get('state')");
  });

  it('leaves the blur to the photograph and does not animate the panel', () => {
    expect(css).not.toMatch(/blur\(|backdrop-filter/);
    const panelRules = [...css.matchAll(/\.(?:hpanel|htone)[^{]*\{[^}]*\}/g)].map((m) => m[0]).join('\n');
    expect(panelRules).not.toMatch(/transition|animation/);
  });

  it('puts no orange on the chips', () => {
    const chip = css.match(/\.chip \{[^}]*\}/)![0];
    expect(chip).not.toMatch(/orange|ff4f00|var\(--sel\)/i);
    expect(css).not.toContain('--color-orange');
  });
});
