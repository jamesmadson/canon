import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const page = (name: string) => {
  const out = execFileSync('node', ['tests/helpers/renderPage.mjs', name], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  return out.slice(out.indexOf('\u0001') + 1);
};

let html = '';
let heroA = '';
beforeAll(() => {
  html = page('index');
  heroA = page('hero-a');
}, 120_000);

const stage = () => html.slice(html.indexOf('data-scatter'), html.indexOf('</section>', html.indexOf('data-scatter')));

describe('the scattered hero at /', () => {
  it('is in search results and carries the heading and the action', () => {
    expect(html).not.toContain('noindex');
    expect(html).toContain('Your prototypes are everywhere.');
    expect(html).toMatch(/Canon keeps them in one[\s\u00a0]place\./);
    expect(html).toMatch(/<a class="hbtn hbtn-primary" href="\/canon\/app\/"[^>]*>Open the app<\/a>/);
    expect(html).toMatch(/Connect your[\s\u00a0]agent/);
    expect(html).not.toMatch(/Try the MCP/);
    expect(html).toContain('claude mcp add canon --scope user -- npx -y usecanon mcp');
    expect(html).not.toContain('class="term');
  });

  it('draws eight cards in three projects, each with a text chip naming where it lives', () => {
    const s = stage();
    expect(s.match(/data-card/g)).toHaveLength(8);
    const chips = [...s.matchAll(/<span class="[^"]*chip[^"]*"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(chips).toEqual(['v0', 'localhost:5173', 'settings-new.zip', 'Bolt', 'Lovable', 'Figma Make', 'Claude Code', 'Codex']);
    for (const name of ['Web app', 'Marketing site', 'iPhone app']) expect(s).toContain(`<b>${name}</b>`);
    // Three shelves of three, two and three, and a name for each prototype.
    const shelves = s.split('<div class="shelf">').slice(1);
    expect(shelves.map((sh) => sh.match(/data-card/g)!.length)).toEqual([3, 2, 3]);
    for (const name of ['Dashboard', 'People', 'Settings', 'Landing page', 'Pricing', 'Onboarding', 'Today', 'Profile']) {
      expect(s).toContain(`<div class="pname fxn">${name}</div>`);
    }
  });

  it('has a decorative terminal that types the request and then shows the reply', () => {
    const box = html.slice(html.indexOf('class="pbox"'), html.indexOf('data-scatter'));
    expect(box).toContain('role="img"');
    expect(box).toContain('data-prompt="Put all my prototypes in Canon, by project."');
    expect(box.replace(/<[^>]+>/g, '').replace(/&gt;/g, '>').replace(/\s/g, '')).toContain('>Putallmyprototypesin Canon,byproject.'.replace(' ', ''));
    expect(box.match(/class="pc"/g)).toHaveLength('Put all my prototypes in Canon, by project.'.replaceAll(' ', '').length);
    expect(box).toContain('class="pcaret"');
    expect(box).not.toMatch(/<(a|button|input|select|textarea)\b|tabindex/);
  });

  it('shows a Claude Code session: title bar, four lines, and the input box with its hint', () => {
    const box = html.slice(html.indexOf('class="pbox"'), html.indexOf('data-scatter'));
    const flat = (x: string) => x.replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ').replace(/&gt;/g, '>').replace(/&#39;|&#x27;/g, '’');
    expect(flat(box.slice(box.indexOf('class="pbar"'), box.indexOf('class="pbody"')))).toContain('fieldnote · claude');
    expect(box.match(/class="pdots"><i><\/i><i><\/i><i><\/i>/g)).toHaveLength(1);
    // 1 the typed request, 2 the tool call, 3 its result, 4 the answer.
    expect(box.indexOf('class="ptext"')).toBeLessThan(box.indexOf('canon - canon_add (MCP)'));
    const steps = [...box.matchAll(/<div class="pstep[^"]*">([\s\S]*?)<\/div>/g)].map((m) => flat(m[1]).trim());
    expect(steps).toEqual([
      '⏺canon - canon_add (MCP)',
      '⎿  Added 8 prototypes to 3 projects',
      '⏺Done. They’re in Canon under Web app, Marketing site and iPhone app.',
    ]);
    expect(box).toContain('<span class="pmark pblue">⏺</span>');
    expect(box.indexOf('class="pinput"')).toBeGreaterThan(box.indexOf('Done.'));
    expect(flat(box.slice(box.indexOf('class="pinput"')))).toContain('? for shortcuts');
    expect(box).toContain('class="pcur"');
    // No Claude or Anthropic logo, no picture at all.
    expect(box).not.toMatch(/<img|<svg|anthropic/i);
    // The label says what happened, for people who cannot see it.
    expect(box).toMatch(/aria-label="A Claude Code session[^"]*8 prototypes to 3 projects[^"]*Web app, Marketing site and iPhone app/);
  });

  it('is a dark terminal in the site’s mono, with no orange', () => {
    const css = read('src/components/home/HeroScatter.astro');
    const pbox = css.match(/\.pbox \{[^}]*\}/)![0];
    expect(pbox).toContain('background: #1a1918');
    expect(pbox).toContain('border-radius: 11px');
    expect(pbox).toContain('font-family: var(--font-mono)');
    expect(pbox).toContain('font-size: 13px');
    expect(css).toMatch(/--pt-ink: #edebe6/);
    expect(css).toMatch(/--pt-muted: #a29e96/);
    expect(css).not.toMatch(/ff4f00|--color-orange/i);
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

  it('is the default hero of the homepage', () => {
    expect(read('src/pages/index.astro')).not.toContain('hero=');
    expect(read('src/components/home/HomePage.astro')).toContain("hero = 'tabs'");
    expect(html).toContain('class="hero hero-b hero-tabs"');
  });
});

describe('the earlier terminal hero at /hero-a/', () => {
  it('is kept out of search results and still draws the terminal and the app window', () => {
    expect(heroA).toContain('<meta name="robots" content="noindex">');
    expect(heroA).toContain('class="term');
    expect(heroA).toContain('class="stage');
    expect(heroA).not.toContain('data-scatter');
    expect(read('src/pages/hero-a.astro')).toContain('hero="terminal"');
  });

  it('is its own page, and the old /hero-b/ address lands on the homepage', () => {
    expect(existsSync(join(root, 'src/pages/hero-a.astro'))).toBe(true);
    expect(existsSync(join(root, 'src/pages/hero-b.astro'))).toBe(false);
    expect(read('astro.config.mjs')).toContain("'/hero-b': '/canon/'");
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
    // The cursor in the line and the one in the input box blink; reduced motion stops the second.
    expect([...css.matchAll(/animation:/g)]).toHaveLength(3);
    // The session is shown whole, without its typing cursor, under reduced motion.
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
