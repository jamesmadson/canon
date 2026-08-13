import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { kitSchema } from '../../src/content/kitSchema';
import { skillSchema } from '../../src/content/skillSchema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kitsDir = path.join(__dirname, '../../src/content/kits');
const skillsDir = path.join(__dirname, '../../src/content/skills');
const publicDir = path.join(__dirname, '../../public');

const kitFiles = readdirSync(kitsDir).filter((f) => f.endsWith('.mdx'));
const skillSlugs = new Set(
  readdirSync(skillsDir)
    .filter((f) => f.endsWith('.mdx'))
    .map((f) => skillSchema.parse(matter(readFileSync(path.join(skillsDir, f), 'utf-8')).data).slug)
);

describe('kits corpus integrity', () => {
  it('has exactly the four launch kits', () => {
    expect(kitFiles.length).toBe(4);
  });

  for (const file of kitFiles) {
    const { data } = matter(readFileSync(path.join(kitsDir, file), 'utf-8'));

    it(`${file} has valid frontmatter matching kitSchema`, () => {
      expect(() => kitSchema.parse(data)).not.toThrow();
    });

    it(`${file}'s skill references all resolve to real skills`, () => {
      const kit = kitSchema.parse(data);
      for (const phase of kit.phases) {
        for (const entry of phase.entries) {
          expect(skillSlugs.has(entry.skill), `${entry.skill} referenced by ${file} does not exist`).toBe(true);
        }
      }
    });

    it(`${file} references each skill at most once across phases`, () => {
      const kit = kitSchema.parse(data);
      const all = kit.phases.flatMap((p) => p.entries.map((e) => e.skill));
      expect(new Set(all).size).toBe(all.length);
    });

    it(`${file}'s digest file exists in public/`, () => {
      const kit = kitSchema.parse(data);
      expect(existsSync(path.join(publicDir, kit.digestPath)), `${kit.digestPath} missing`).toBe(true);
    });
  }

  it('has unique kit slugs', () => {
    const slugs = kitFiles.map((f) => matter(readFileSync(path.join(kitsDir, f), 'utf-8')).data.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
