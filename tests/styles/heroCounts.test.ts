import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { TAB_OF_CARD, TABS } from '../../src/components/home/heroVariants';
import { thumbHtml, thumbTint, type HeroThumbKey } from '../../src/lib/thumbs';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const flat = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');

let html = '';
let heroD = '';
beforeAll(() => {
  const page = (name: string) => {
    const out = execFileSync('node', ['tests/helpers/renderPage.mjs', name], { cwd: root, encoding: 'utf8', maxBuffer: 20_000_000 });
    return out.slice(out.indexOf('\u0001') + 1);
  };
  html = page('index');
  heroD = page('hero-d');
}, 180_000);

const heroText = () => html.slice(html.indexOf('class="htext"'), html.indexOf('class="hpanel"'));

describe('the hero’s words', () => {
  it('has the heading, one lede line, two buttons and one fine-print line', () => {
    const h = heroText();
    expect(h).toContain('Your prototypes are everywhere.');
    expect(h.match(/<p class="lede[^"]*"/g)).toHaveLength(1);
    expect(flat(h.match(/<p class="lede[^"]*">([\s\S]*?)<\/p>/)![1]).trim()).toBe('Links, zips and agent builds, filed by project on your machine.');
    const cta = h.match(/<div class="cta[^"]*">([\s\S]*?)<\/div>/)![1];
    expect(cta.match(/class="hbtn/g)).toHaveLength(2);
    expect(h.match(/<p class="fine/g)).toHaveLength(1);
  });

  it('has no waitlist button in the hero, and the page still links to the hosted section', () => {
    expect(flat(heroText())).not.toMatch(/waitlist/i);
    expect(heroText()).not.toContain('href="#hosted"');
    expect(html).toContain('id="hosted"');
    expect(read('src/components/home/SectionNav.astro')).toContain("href: '/#hosted'");
  });
});

describe('three projects and eight prototypes, everywhere', () => {
  it('agree in the terminal, the window, the sidebar, the shelves and the tabs', () => {
    const flatHtml = flat(html);
    expect(flatHtml).toContain('Added 8 prototypes to 3 projects');
    expect(flatHtml).toContain('8 prototypes in 3 projects');
    expect(flatHtml).not.toMatch(/\b(9|nine) prototypes/);
    const aria = html.match(/aria-label="A Claude Code session[^"]*"/)![0];
    expect(aria).toContain('8 prototypes to 3 projects');
    // The sidebar lists the three projects with counts that add up.
    const side = html.slice(html.indexOf('class="wn-sec">Projects'), html.indexOf('class="wn-foot"'));
    const counts = [...side.matchAll(/<div class="wn-nav">([^<]+)<small>(\d+)<\/small>/g)].map((m) => [m[1], Number(m[2])]);
    expect(counts).toEqual([['Web app', 3], ['Marketing site', 2], ['iPhone app', 3]]);
    // The shelf heads say the same.
    const heads = [...html.matchAll(/<div class="shead fx"><b>([^<]+)<\/b><span class="muted">(\d+) prototypes<\/span>/g)].map((m) => [m[1], Number(m[2])]);
    expect(heads).toEqual(counts);
    expect(html.match(/data-card/g)).toHaveLength(8);
    // Every card has a tab, and every one of those tabs is readable when the loop opens.
    expect(TAB_OF_CARD).toHaveLength(8);
    expect(new Set(TAB_OF_CARD).size).toBe(8);
    for (const n of TAB_OF_CARD) expect(n).toBeLessThan(8);
    expect(heroD.match(/data-tab-of="\d"/g)).toHaveLength(8);
  });

  it('draw every prototype in the hero with a thumbnail of real words, not bars alone', () => {
    const keys: HeroThumbKey[] = ['dash', 'people', 'settings', 'land', 'price', 'onb', 'today', 'prof'];
    for (const k of keys) {
      const words = flat(thumbHtml(k)).trim();
      expect(words.split(' ').length, k).toBeGreaterThanOrEqual(8);
      expect(thumbHtml(k), k).not.toMatch(/https?:|@[\w-]+\.[a-z]{2,}/i);
    }
  });

  it('give each project one tint, different from the others', () => {
    const tint = (ks: HeroThumbKey[]) => [...new Set(ks.map(thumbTint))];
    const web = tint(['dash', 'people', 'settings']);
    const site = tint(['land', 'price']);
    const phone = tint(['onb', 'today', 'prof']);
    expect([web.length, site.length, phone.length]).toEqual([1, 1, 1]);
    expect(new Set([web[0], site[0], phone[0]]).size).toBe(3);
    // The first eight tabs carry their project’s tint.
    const tabTints = TABS.map(([, t]) => t);
    expect(tabTints[TAB_OF_CARD[4]]).toBe(site[0]);
    expect(tabTints[TAB_OF_CARD[0]]).toBe(web[0]);
    expect(tabTints[TAB_OF_CARD[7]]).toBe(phone[0]);
  });

  it('keeps the phone prototypes in portrait phone frames', () => {
    for (const k of ['onb', 'today', 'prof'] as const) expect(thumbHtml(k)).toContain('class="tq-phone"');
    const css = read('src/components/home/HomeStyles.astro');
    const phone = css.match(/\.thumb \.tq-phone \{[^}]*\}/)![0];
    const w = Number(phone.match(/width: ([\d.]+)cqw/)![1]);
    const h = Number(phone.match(/height: ([\d.]+)cqw/)![1]);
    expect(h).toBeGreaterThan(w * 2);
  });
});
