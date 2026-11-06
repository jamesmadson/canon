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
const STORIES: Record<string, string> = {
  graft: 'Ever lose the moment in a long chat where you picked a direction? Scrolling back through hours of replies to find where it went wrong is slow. Graft turns the session into one page with every turn on a timeline. Find the turn, see what you had then, and copy a command to pick up the chat from there or put your files back the way they were. Run it again whenever you want the page to catch up.',
  strata: 'Someone says one thing in an interview, and three weeks later it has become \u201cusers are demanding this.\u201d Strata files each piece of feedback with its date and the person\u2019s own words, kept apart from what you think they meant. Ask what people have said and you get the quotes and an honest count, so one comment stays one comment.',
  lath: 'Show a polished mockup too early and the review becomes a talk about colour and type while the structure goes unquestioned. Lath sketches the screen from a small kit of plain parts, with real words and every state listed. The first review is about what the screen holds and why.',
  prune: 'Every round of feedback adds something to a screen, and nobody asks what should come out. Prune reads the screen against its job and tells you what to cut, one thing at a time, with the reason and how often people actually meet that part. It changes nothing until you ask.',
};
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

  // Mutation: change any one word in any story, in the .mdx file or here, fails this.
  it('each story is James\u2019s text, word for word', () => {
    for (const slug of SLUGS) {
      expect(matter(read(`src/content/skills/${slug}.mdx`)).data.story, slug).toBe(STORIES[slug]);
    }
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
    const entry = parseStrataEntry(raw, 'f.md');
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
    const cut = parsePruneCut(raw, 'f.md');
    expect(cut.heading).toContain('Wait! Get 10% off');
    expect(cut.reason).toContain('It sits on top of the plan cards');
    expect(raw).toContain(cut.reason);
    expect(step).toContain('line-through');
    expect(step).toContain('{cut.heading}');
  });

  // Mutation: delete the `throw` lines in previewParse.ts fails the next two tests.
  it('the Strata reader throws, naming the file and the heading, when one is missing', () => {
    const raw = read('public/previews/strata/2026-10-06-annual-card-form-total.md');
    expect(() => parseStrataEntry(raw.replace('## Said', '## Quote'), 'strata.md')).toThrow(/strata\.md.*## Said/);
    expect(() => parseStrataEntry(raw.replace('## Meant', '## Read'), 'strata.md')).toThrow(/strata\.md.*## Meant/);
    expect(() => parseStrataEntry(raw.replace(/^date:.*$/m, ''), 'strata.md')).toThrow(/strata\.md.*date/);
    expect(() => parseStrataEntry('', 'strata.md')).toThrow(/strata\.md/);
  });

  it('the Prune reader throws, naming the file and the heading, and reads only under Removals', () => {
    const raw = read('public/previews/prune/review.md');
    expect(() => parsePruneCut(raw.replace('Removals', 'Cuts'), 'review.md')).toThrow(/review\.md.*Removals/);
    expect(() => parsePruneCut(raw.replace(/^1\. /m, '- '), 'review.md')).toThrow(/review\.md.*Removals/);
    // A numbered item before the Removals heading is not the first cut.
    const before = '1. **Early.** Not a cut.\n\n' + raw;
    expect(parsePruneCut(before, 'review.md').heading).toContain('Wait! Get 10% off');
    // A numbered item after the next heading is not under Removals.
    const cropped = raw.slice(0, raw.indexOf('1. **')) + raw.slice(raw.indexOf('**3 \u00b7'));
    expect(() => parsePruneCut(cropped, 'review.md')).toThrow(/Removals/);
  });

  // Mutation: remove the .replace of \r in previewParse.ts fails this.
  it('reads a file with Windows line endings', () => {
    const raw = read('public/previews/strata/2026-10-06-annual-card-form-total.md').replace(/\n/g, '\r\n');
    expect(parseStrataEntry(raw, 'f.md').date).toBe('2026-10-06');
  });

  // Mutation: set the step labels back to class="label" in SkillStep.astro fails this.
  it('step labels are Public Sans, and the link follows the preview in reading order', () => {
    expect(step).toContain('<p class="small text-balance" set:html={step} />');
    expect(step).not.toContain('class="label');
    expect(step.indexOf('class={`frame frame-${slug}`}')).toBeLessThan(step.indexOf('See what it made'));
  });
});
