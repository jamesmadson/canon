import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { ORDER, SKILL_LINES } from '../../src/lib/skillLines';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../../src');
const read = (p: string) => readFileSync(path.join(src, p), 'utf-8');

describe('the skills index', () => {
  // Mutation: reorder SKILL_LINES in src/lib/skillLines.ts; this fails.
  it('lists Strata, Lath, Prune and Graft, in the order work does', () => {
    expect(ORDER).toEqual(['strata', 'lath', 'prune', 'graft']);
    for (const slug of ORDER) expect(SKILL_LINES[slug]).toBeTruthy();
  });

  // Mutation: paste a local SKILL_LINES back into src/pages/index.astro; this fails.
  it('the index is the list component, the homepage walks the same order, and neither owns a table of lines', () => {
    const home = read('pages/index.astro');
    const index = read('pages/skills/index.astro');
    expect(home).toContain('<SkillStep');
    expect(home).toContain('ORDER.indexOf');
    expect(index).toContain('<SkillList />');
    expect(home).not.toMatch(/SKILL_LINES\s*[:=]/);
    expect(index).not.toMatch(/SKILL_LINES\s*[:=]/);
  });

  // Mutation: write the install steps inline in either page; this fails.
  it('shows the same install block as each skill page', () => {
    expect(read('pages/skills/index.astro')).toContain('<InstallBlock');
    expect(read('pages/skills/[slug].astro')).toContain('<InstallBlock');
  });

  // Mutation: add `rating: 4` to strata.mdx; this fails.
  it('keeps no gallery fields in the skill files', () => {
    const dir = path.join(src, 'content/skills');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.mdx'))) {
      const data = matter(readFileSync(path.join(dir, f), 'utf-8')).data;
      for (const key of ['rating', 'categories', 'fileTree', 'contentOutline', 'companionPaths', 'featured', 'lastVerified']) {
        expect(data, `${f} has ${key}`).not.toHaveProperty(key);
      }
    }
  });
});
