import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ORDER, SKILL_DOT } from '../../src/lib/skillLines';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const css = read('src/styles/global.css');

// D-125: slug, light, dark.
const DOTS: Array<[string, string, string]> = [
  ['strata', '#AD723F', '#C08552'],
  ['lath', '#5E83A6', '#7F9CB8'],
  ['prune', '#658952', '#7FA66A'],
  ['graft', '#8371CD', '#9A8BD6'],
];

const values = (token: string) =>
  [...css.matchAll(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1].toUpperCase());

// The text of the first block that starts with `open`, up to its closing brace.
function block(open: string): string {
  const start = css.indexOf(open);
  expect(start, `${open} is in global.css`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`Unclosed block ${open}`);
}

describe('the skill dot tokens (D-125)', () => {
  for (const [slug, light, dark] of DOTS) {
    const token = `--skill-${slug}`;
    // Mutation: change this token's light hex in the :root block of global.css.
    it(`${token} is ${light} in light`, () => {
      expect(values(token)[0]).toBe(light);
    });
    // Mutation: change this token's dark hex in the explicit dark block.
    it(`${token} is ${dark} in the explicit dark block`, () => {
      expect(block(':root[data-app-theme="dark"]')).toContain(`${token}: ${dark}`);
    });
    // Mutation: change this token's dark hex in the System dark block.
    it(`${token} is ${dark} in the System dark block`, () => {
      expect(block('@media (prefers-color-scheme: dark)')).toContain(`${token}: ${dark}`);
    });
  }
});

describe('skillLines', () => {
  // Mutation: delete one entry from SKILL_DOT in skillLines.ts.
  it('maps every slug in ORDER to its token', () => {
    expect(ORDER).toEqual(DOTS.map(([slug]) => slug));
    for (const slug of ORDER) expect(SKILL_DOT[slug]).toBe(`--skill-${slug}`);
  });
});

describe('where the dots go', () => {
  // Mutation: remove the SkillDot from the header in BaseLayout.astro.
  it('the header shows all four, decorative, inside the home link', () => {
    const layout = read('src/layouts/BaseLayout.astro');
    const link = layout.slice(layout.indexOf('class="home-mark'), layout.indexOf('</a>', layout.indexOf('class="home-mark')));
    expect(link).toContain('ORDER.map((slug) => <SkillDot slug={slug} size={6} />)');
    expect(link).toContain('aria-hidden="true"');
  });
  // Mutation: remove the SkillDot from SkillList.astro.
  it('the /skills/ rows show one', () => {
    expect(read('src/components/SkillList.astro')).toContain('<SkillDot slug={s.data.slug}');
  });
  // Mutation: remove the SkillDot from SkillStep.astro.
  it('the homepage steps show one', () => {
    expect(read('src/components/SkillStep.astro')).toContain('<SkillDot slug={slug}');
  });
  // Mutation: remove the SkillDot from the h1 in [slug].astro.
  it('the skill page heading shows one', () => {
    expect(read('src/pages/skills/[slug].astro')).toMatch(/<h1[^>]*><SkillDot slug=\{slug\}/);
  });
  // Mutation: remove aria-hidden from SkillDot.astro.
  it('the dot is a hidden circle', () => {
    const dot = read('src/components/SkillDot.astro');
    expect(dot).toContain('aria-hidden="true"');
    expect(dot).toContain('border-radius: 50%');
  });
});

describe('the hover preview', () => {
  const list = read('src/components/SkillList.astro');
  const FINE = '@media (hover: hover) and (pointer: fine)';
  // Mutation: replace SkillPreview in SkillStep.astro with inline markup.
  it('the homepage and /skills/ both use SkillPreview', () => {
    expect(read('src/components/SkillStep.astro')).toContain('<SkillPreview slug={slug} />');
    expect(list).toContain('<SkillPreview slug={s.data.slug} variant="hover" />');
  });
  // Mutation: move the .skill-preview display:block rule outside the media query.
  it('the hover rules sit inside the fine-pointer media query', () => {
    const style = list.slice(list.indexOf('<style>'));
    const outside = style.replace(/@media \(hover: hover\) and \(pointer: fine\)[^{]*\{(?:[^{}]*\{[^{}]*\}|@starting-style \{(?:[^{}]*\{[^{}]*\})*\s*\}|[^{}])*\}/g, '');
    expect(style.match(new RegExp(FINE.replace(/[()]/g, '\\$&'), 'g'))?.length).toBeGreaterThanOrEqual(2);
    expect(outside).not.toMatch(/:hover/);
    expect(outside).not.toContain('display: block');
    expect(outside).not.toContain('opacity: 0.5');
  });
  // Mutation: remove loading="lazy" or the aria-hidden wrapper.
  it('is lazy, hidden from screen readers and takes no pointer', () => {
    expect(read('src/components/SkillPreview.astro')).toContain('loading="lazy"');
    expect(list).toContain('class="skill-preview" aria-hidden="true"');
    expect(list).toContain('pointer-events: none');
  });
  // Mutation: delete the reduced-motion block in SkillList.astro.
  it('reduced motion drops transform and filter', () => {
    const rm = list.slice(list.indexOf('(prefers-reduced-motion: reduce)'));
    const rest = rm.slice(rm.indexOf('.skill-preview {'));
    expect(rest.slice(0, rest.indexOf('}'))).toMatch(/transform: none;\s*filter: none;/);
    const start = rm.slice(rm.indexOf('@starting-style'));
    expect(start.slice(0, start.indexOf('}'))).toMatch(/transform: none;\s*filter: none;/);
    expect(rm).not.toContain('opacity: 0');
  });
  // Mutation: change 220ms to 300ms in the hover rule.
  it('fades in over 220ms and out over 160ms on the one curve', () => {
    expect(list).toContain('transition-duration: 220ms');
    expect(list).toContain('opacity 160ms cubic-bezier(0.2, 0, 0, 1)');
    expect(list).toContain('filter: blur(4px)');
  });
});
