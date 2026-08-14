import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { DEMO_CASES } from '../../src/data/demoCases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const kitSlugs = new Set(
  readdirSync(path.join(root, 'src/content/kits'))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => matter(readFileSync(path.join(root, 'src/content/kits', f), 'utf-8')).data.slug)
);

const skillSlugs = new Set(
  readdirSync(path.join(root, 'src/content/skills'))
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => matter(readFileSync(path.join(root, 'src/content/skills', f), 'utf-8')).data.slug)
);

// Digests are hard-wrapped Markdown prose: a sentence that is verbatim and
// contiguous in the source can still cross a line-wrap boundary, where the
// raw file has a newline where rendered prose would have a space. Collapse
// all whitespace runs (including newlines) to a single space before
// comparing, on both sides, so wrapping position doesn't affect the check.
const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('demo cases', () => {
  it('has exactly three cases', () => {
    expect(DEMO_CASES).toHaveLength(3);
  });

  it('has unique ids', () => {
    const ids = DEMO_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const demoCase of DEMO_CASES) {
    it(`${demoCase.id} routes to a real kit`, () => {
      expect(kitSlugs.has(demoCase.route), `${demoCase.route} is not a real kit`).toBe(true);
    });

    it(`${demoCase.id} names only real skills`, () => {
      expect(demoCase.skills.length).toBeGreaterThan(0);
      for (const slug of demoCase.skills) {
        expect(skillSlugs.has(slug), `${slug} is not a real skill`).toBe(true);
      }
    });

    it(`${demoCase.id} has a prompt and a 3-5 line excerpt`, () => {
      expect(demoCase.prompt.trim().length).toBeGreaterThan(10);
      expect(demoCase.excerpt.length).toBeGreaterThanOrEqual(3);
      expect(demoCase.excerpt.length).toBeLessThanOrEqual(5);
    });

    it(`${demoCase.id} excerpt lines are verbatim from that kit's digest`, () => {
      const digestPath = path.join(root, 'public/kits', `${demoCase.route}-digest.md`);
      const digestText = normalize(readFileSync(digestPath, 'utf-8'));
      for (const line of demoCase.excerpt) {
        expect(
          digestText.includes(normalize(line)),
          `excerpt line not found verbatim in ${demoCase.route}-digest.md: "${line}"`
        ).toBe(true);
      }
    });
  }

  it('covers all three routed kits', () => {
    const routes = DEMO_CASES.map((c) => c.route).sort();
    expect(routes).toEqual(['marketing-site', 'mobile-first-review', 'product-ui']);
  });
});
