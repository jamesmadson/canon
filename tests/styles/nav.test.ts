import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const page = (name: string) => {
  const out = execFileSync('node', ['tests/helpers/renderPage.mjs', name], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
  return out.slice(out.indexOf('\u0001') + 1);
};

let home = '';
let skills = '';
beforeAll(() => {
  home = page('index');
  skills = page('skills/index');
}, 120_000);

const pill = (html: string) => html.match(/<nav class="pill"[\s\S]*?<\/nav>/)![0];
const links = (html: string) => [...pill(html).matchAll(/<a href="([^"]+)"([^>]*)>\s*([^<]+?)\s*<\/a>/g)].map((m) => ({ href: m[1], attrs: m[2], label: m[3] }));

describe('the top of the page', () => {
  it('has the wordmark at the left and Open the app at the right, and no other links', () => {
    const header = skills.slice(skills.indexOf('<header'), skills.indexOf('</header>'));
    expect(header.match(/<a\b/g)).toHaveLength(2);
    expect(header).toContain('aria-label="Canon, home"');
    expect(header).toMatch(/<a class="hbtn hbtn-small" href="\/canon\/app\/"[^>]*>Open the app<\/a>/);
    expect(header).not.toContain('<nav');
  });

  // Mutation: drop the hero prop from the homepage, or render the header button regardless.
  it('leaves Open the app out of the homepage header, where the hero has its own', () => {
    const header = home.slice(home.indexOf('<header'), home.indexOf('</header>'));
    expect(header.match(/<a\b/g)).toHaveLength(1);
    expect(header).toContain('aria-label="Canon, home"');
    expect(home.match(/>Open the app<\/a>/g)).toHaveLength(1);
  });

  it('moves GitHub to the footer', () => {
    expect(home).toContain('Source on GitHub');
    expect(links(home).map((l) => l.label)).not.toContain('GitHub');
  });
});

describe('the section pill', () => {
  it('is one nav landmark named Sections, with five links in order', () => {
    for (const html of [home, skills]) {
      expect(html.match(/<nav\b/g)).toHaveLength(1);
      expect(pill(html)).toContain('aria-label="Sections"');
      expect(links(html).map((l) => l.label)).toEqual(['Projects', 'Agents', 'Search', 'Hosted', 'Skills']);
    }
  });

  it('links to sections in page on the homepage, and Skills to /skills/', () => {
    expect(links(home).map((l) => l.href)).toEqual(['#projects', '#agents', '#find', '#hosted', '/canon/skills/']);
    for (const id of ['projects', 'agents', 'find', 'hosted']) expect(home).toContain(`id="${id}"`);
  });

  it('marks Skills current on /skills/, and sends the sections to the homepage', () => {
    const l = links(skills);
    expect(l.map((x) => x.href)).toEqual(['/canon/#projects', '/canon/#agents', '/canon/#find', '/canon/#hosted', '/canon/skills/']);
    expect(l.filter((x) => x.attrs.includes('aria-current'))).toEqual([expect.objectContaining({ label: 'Skills', attrs: expect.stringContaining('aria-current="page"') })]);
  });

  it('marks nothing current in the markup on the homepage, where the script picks the section', () => {
    expect(pill(home)).not.toContain('aria-current');
    expect(pill(home)).toContain('data-home');
  });

  it('is always present on other pages, and waits for 200px of scroll on the homepage', () => {
    expect(pill(skills)).not.toContain('data-home');
    const script = read('src/scripts/nav.ts');
    expect(script).toContain('window.scrollY > 200');
    expect(read('src/components/home/SectionNav.astro')).toMatch(/\.js \.pill\[data-home\]:not\(\.is-on\)/);
  });

  it('steps away while the footer links are on screen, and reads the section with an observer', () => {
    const script = read('src/scripts/nav.ts');
    expect(script).toContain("document.querySelector('.foot .links')");
    expect(script).toContain("toggle('is-away'");
    expect(script).toContain('new IntersectionObserver(pick');
    expect(script).toContain("setAttribute('aria-current', 'location')");
  });
});

describe('the pill styles', () => {
  const css = read('src/components/home/SectionNav.astro');
  const style = css.slice(css.indexOf('<style'));

  it('is fixed at the bottom centre, above the safe area, with 44px targets and full radius', () => {
    expect(style).toMatch(/\.pillwrap \{[^}]*position: fixed[^}]*bottom: calc\(16px \+ env\(safe-area-inset-bottom/);
    expect(style).toMatch(/\.pill \{[^}]*border-radius: 999px/);
    expect(style).toMatch(/\.pill \{[^}]*background: var\(--color-recess\)/);
    expect(style).toMatch(/\.pill a \{[^}]*height: 44px/);
    expect(style).not.toMatch(/\.pill \{[^}]*border:/);
    expect(style).toMatch(/\.pill a \{[^}]*font-size: 15px/);
    expect(style).toMatch(/max-width: 480px\) \{\s*\.pill a \{[^}]*font-size: 13px/);
  });

  it('glides the segment by transform on the spring, and nothing else moves', () => {
    expect(style).toMatch(/\.pill-glide \{[^}]*transform: translateX\(calc\(var\(--i\) \* 100%\)\)/);
    expect(style).toMatch(/transform 360ms var\(--ease-glide\)/);
    for (const m of style.matchAll(/transition:\s*([^;]+);/g)) {
      for (const part of m[1].split(',')) expect(part.trim().split(/\s+/)[0]).toMatch(/^(transform|opacity|visibility)$/);
    }
  });

  it('draws a focus ring on every link and only changes colour on hover with a fine pointer', () => {
    expect(style).toMatch(/\.home \.pill a:focus-visible \{\s*outline: 2px solid var\(--color-ink\)/);
    expect(style).toMatch(/\(hover: hover\) and \(pointer: fine\) \{\s*\.pill a:hover/);
  });

  it('rises 8px when it appears, and only fades under reduced motion', () => {
    expect(style).toMatch(/\.js \.pill\.is-away \{[^}]*transform: translateY\(8px\)/);
    expect(style).toMatch(/prefers-reduced-motion: reduce\) \{[\s\S]*?\.js \.pill\.is-away \{\s*transform: none/);
  });
});
