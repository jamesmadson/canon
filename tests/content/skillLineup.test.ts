import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.join(__dirname, '../../src/content/skills');

const entries = readdirSync(skillsDir)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => matter(readFileSync(path.join(skillsDir, f), 'utf-8')).data);

describe('the skills the site shows', () => {
  // Mutation: delete lath.mdx; this fails with lath missing.
  it('are Canon’s four: Strata, Lath, Prune and Graft', () => {
    const active = entries.filter((d) => d.status === 'active').map((d) => d.slug).sort();
    expect(active).toEqual(['graft', 'lath', 'prune', 'strata']);
  });

  // Mutation: set prune.mdx's previewType back to image; this fails.
  it('each show what the skill makes, never a drawing of it', () => {
    for (const d of entries) {
      expect(d.previewType, `${d.slug} has an image preview`).not.toBe('image');
    }
  });

  it('take no dashes in what the site says about them', () => {
    for (const d of entries) {
      expect(`${d.tagline} ${d.previewNote ?? ''}`, `${d.slug}`).not.toMatch(/[–—]/);
    }
  });
});
