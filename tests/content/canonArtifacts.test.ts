import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { demoteHeadings } from '../../src/lib/buildCanonAll';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const ROUTED = ['marketing-site', 'product-ui', 'mobile-first-review'];

const digest = (slug: string) =>
  readFileSync(path.join(root, 'public/kits', `${slug}-digest.md`), 'utf-8');

describe('generated canon artifacts stay in sync with their sources', () => {
  for (const slug of ROUTED) {
    it(`plugin skill canon-${slug} byte-matches its digest`, () => {
      const generated = readFileSync(
        path.join(root, 'plugin/canon/skills', `canon-${slug}`, 'SKILL.md'),
        'utf-8'
      );
      expect(generated).toBe(digest(slug));
    });
  }

  it('canon-all exists and is under the 500-line spec recommendation', () => {
    const file = path.join(root, 'public/kits/canon-all.md');
    expect(existsSync(file)).toBe(true);
    const lines = readFileSync(file, 'utf-8').split('\n').length;
    expect(lines).toBeLessThan(500);
  });

  it('canon-all has spec-valid frontmatter', () => {
    const { data } = matter(readFileSync(path.join(root, 'public/kits/canon-all.md'), 'utf-8'));
    expect(data.name).toBe('canon-all');
    expect(typeof data.description).toBe('string');
    expect(data.description.length).toBeLessThanOrEqual(1024);
    expect(data.description.toLowerCase()).toContain('use when');
  });

  it("canon-all's inlined sections byte-match their source digest bodies, demoted one heading level", () => {
    const all = readFileSync(path.join(root, 'public/kits/canon-all.md'), 'utf-8');
    for (const slug of ROUTED) {
      const body = demoteHeadings(matter(digest(slug)).content.trim());
      expect(all, `canon-all section for ${slug} does not byte-match its (demoted) digest body`).toContain(body);
    }
  });

  it('canon-all contains exactly one H1', () => {
    const all = readFileSync(path.join(root, 'public/kits/canon-all.md'), 'utf-8');
    const h1Lines = all.split('\n').filter((line) => /^# (?!#)/.test(line));
    expect(h1Lines).toHaveLength(1);
  });

  it('the router names exactly the three routed kits', () => {
    const router = readFileSync(
      path.join(root, 'plugin/canon/skills/canon/SKILL.md'),
      'utf-8'
    );
    for (const slug of ROUTED) {
      expect(router).toContain(`canon-${slug}`);
    }
    expect(router).not.toContain('canon-full-redesign');
  });

  it("the router's frontmatter description keeps its explicit non-auto-trigger clause", () => {
    const router = readFileSync(
      path.join(root, 'plugin/canon/skills/canon/SKILL.md'),
      'utf-8'
    );
    const { data } = matter(router);
    expect(data.description).toContain('NEVER trigger automatically');
  });

  it('the plugin and marketplace manifests parse and carry required fields', () => {
    const plugin = JSON.parse(
      readFileSync(path.join(root, 'plugin/canon/.claude-plugin/plugin.json'), 'utf-8')
    );
    expect(plugin.name).toBe('canon');
    expect(typeof plugin.description).toBe('string');

    const marketplace = JSON.parse(
      readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf-8')
    );
    expect(Array.isArray(marketplace.plugins)).toBe(true);
    expect(marketplace.plugins.length).toBeGreaterThan(0);
    expect(marketplace.plugins[0].name).toBe('canon');
    expect(marketplace.plugins[0].category).toBe('design');
  });
});
