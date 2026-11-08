import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function files(dir: string): string[] {
  return readdirSync(join(root, dir)).flatMap((name) => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? files(rel) : [rel];
  });
}

// James, 2026-11-08: the mark is the one solid orange circle again, and the
// skills carry no colours of their own (D-128, which retires D-125 and D-126).
describe('one orange mark, and no skill colours', () => {
  const site = [...files('src'), ...files('public/icons')].filter((f) => !f.startsWith('src/app') && /\.(astro|css|ts|svg)$/.test(f));

  // Mutation: put a ring colour back in Wordmark.astro, RadialMap.astro, the
  // closing strip in global.css or an icon.
  it('draws no amber ring anywhere', () => {
    for (const f of site) expect(read(f), f).not.toMatch(/#FF9A2E/i);
  });

  // Mutation: put the --skill-strata token back in global.css, or a SkillDot
  // back in the header.
  it('gives no skill a dot or a colour', () => {
    for (const f of site) {
      expect(read(f), f).not.toMatch(/--skill-|SkillDot|SKILL_DOT/);
    }
  });

  // Mutation: draw the logo as an svg again.
  it('draws the logo as one plain circle', () => {
    expect(read('src/components/Wordmark.astro')).toContain(`<span aria-hidden="true" class:list={['wordmark-dot', className]}`);
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
  it('reduced motion drops the transform', () => {
    const rm = list.slice(list.indexOf('(prefers-reduced-motion: reduce)'));
    const rest = rm.slice(rm.indexOf('.skill-preview {'));
    expect(rest.slice(0, rest.indexOf('}'))).toMatch(/transform: none;/);
    const start = rm.slice(rm.indexOf('@starting-style'));
    expect(start.slice(0, start.indexOf('}'))).toMatch(/transform: none;/);
    expect(rm).not.toContain('opacity: 0');
  });
  // Mutation: change 320ms back to 220ms in the hover rule.
  it('fades in over 320ms and out over 200ms on the one curve', () => {
    expect(list).toContain('transition-duration: 320ms');
    expect(list).toContain('opacity 200ms cubic-bezier(0.2, 0, 0, 1)');
  });
  // Mutation: put a blur back on the preview. D-114 allows blur only on a
  // floating surface opening or closing, and a hover preview is not one.
  it('never blurs the preview', () => {
    expect(list).not.toMatch(/filter|blur/);
  });

  // Mutation: position the preview with top/left from the script, or drop
  // the translate, so it stops following the cursor.
  it('follows the cursor by translate, below and beside it, flipping near the right edge', () => {
    expect(list).toContain('translate: var(--x, 0px) var(--y, 72px);');
    expect(list).toMatch(/row\.addEventListener\('pointermove'/);
    expect(list).toContain('x + OFFSET + WIDTH > box.width ? x - OFFSET - WIDTH : x + OFFSET');
  });
  // Mutation: ease toward the cursor even with reduced motion.
  it('places it outright with reduced motion', () => {
    expect(list).toContain('if (!at || still.matches) {');
  });
});
