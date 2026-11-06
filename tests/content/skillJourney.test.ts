import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { parseStrataEntry, parsePruneCut } from '../../src/lib/previewParse';
import { ORDER, SKILL_STEPS } from '../../src/lib/skillLines';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf-8');
const plain = (s: string) => s.replace(/&nbsp;| /g, ' ');

const SLUGS = ['strata', 'lath', 'prune', 'graft'];
const home = read('src/pages/index.astro');
const step = read('src/components/SkillStep.astro');
const page = read('src/pages/skills/[slug].astro');

describe('skill stories', () => {
  for (const slug of SLUGS) {
    const data = matter(read(`src/content/skills/${slug}.mdx`)).data;

    // Mutation: deleting `story` from lath.mdx fails this.
    it(`${slug} has a story with no em or en dash`, () => {
      expect(typeof data.story).toBe('string');
      expect(data.story.length).toBeGreaterThan(100);
      expect(data.story).not.toMatch(/[–—]/);
    });
  }

  // Mutation: change a word in graft.mdx's story fails this.
  it('the stories are the ones James wrote', () => {
    expect(matter(read('src/content/skills/graft.mdx')).data.story).toMatch(/^Ever lose the moment in a long chat where you picked a direction\?/);
    expect(matter(read('src/content/skills/strata.mdx')).data.story).toContain('“users are demanding this.”');
    expect(matter(read('src/content/skills/lath.mdx')).data.story).toMatch(/about what the screen holds and why\.$/);
    expect(matter(read('src/content/skills/prune.mdx')).data.story).toMatch(/It changes nothing until you ask\.$/);
  });

  // Mutation: put {tagline} back under the h1 in [slug].astro fails this.
  it('the skill page shows the story under the h1, and the tagline only as the description', () => {
    expect(page).toMatch(/text-pretty">\{story\}<\/p>/);
    expect(page).not.toMatch(/text-pretty">\{tagline\}<\/p>/);
    expect(page).toContain('description={tagline}');
  });
});

describe('the homepage skills section', () => {
  // Mutation: rename the heading in index.astro fails this.
  it('has the heading and intro', () => {
    const text = plain(home);
    expect(text).toContain('Skills for each step of the work.');
    expect(text).toContain('Canon installs four skills your agent can follow. They go in the order the work does, from what people told you to the turn you want back.');
  });

  // Mutation: swap two labels in SKILL_STEPS fails this.
  it('has the four step labels in order', () => {
    expect(ORDER.map((s) => plain(SKILL_STEPS[s]))).toEqual([
      'When people tell you something',
      'Before you design',
      'Before a review',
      'When you lose your way',
    ]);
  });

  // Mutation: remove the sandbox attribute from the Graft frame fails this.
  it('frames Lath and Graft from the real files with the shared sandbox values, inert and lazy', () => {
    expect(step).toContain('/previews/lath/checkout-payment.html');
    expect(step).toContain('/previews/graft/demo-session.html');
    expect(step).toContain("from '../lib/frameSandbox'");
    expect(step).toContain("slug === 'graft' ? SCRIPTED_SANDBOX : STATIC_SANDBOX");
    for (const needle of ['loading="lazy"', 'tabindex="-1"', 'aria-hidden="true"', 'pointer-events: none']) {
      expect(step, needle).toContain(needle);
    }
    expect(existsSync(path.join(root, 'public/previews/lath/checkout-payment.html'))).toBe(true);
    expect(existsSync(path.join(root, 'public/previews/graft/demo-session.html'))).toBe(true);
  });

  // Mutation: retype the Said quote in SkillStep.astro instead of using strata.said fails this.
  it('Strata card carries words read from its file, with Said and Meant apart', () => {
    const raw = read('public/previews/strata/2026-10-06-annual-card-form-total.md');
    const entry = parseStrataEntry(raw);
    expect(entry.date).toBe('2026-10-06');
    expect(entry.said).toContain('the only number I could see was $39');
    expect(raw).toContain(entry.said.slice(0, 40));
    expect(entry.meant).toContain('One participant, so this is a quote, not a pattern.');
    expect(step).toContain('{strata.said}');
    expect(step).toContain('{strata.meant}');
    expect(step).toMatch(/>Said<[\s\S]*>Meant</);
  });

  // Mutation: make parsePruneCut take the second list item fails this.
  it('Prune card is the first removal in review.md', () => {
    const raw = read('public/previews/prune/review.md');
    const cut = parsePruneCut(raw);
    expect(cut.heading).toContain('Wait! Get 10% off');
    expect(cut.reason).toContain('It sits on top of the plan cards');
    expect(raw).toContain(cut.reason);
    expect(step).toContain('line-through');
    expect(step).toContain('{cut.heading}');
  });

  // Mutation: reorder the rows in dist or in ORDER fails this (needs a build).
  it.skipIf(!existsSync(path.join(root, 'dist/index.html')))('the built homepage has the four rows in order', () => {
    const html = read('dist/index.html');
    const at = SLUGS.map((s) => html.indexOf(`data-skill-step="${s}"`));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(html).toContain('the only number I could see was $39');
    expect(html).toContain('It sits on top of the plan cards');
  });
});
