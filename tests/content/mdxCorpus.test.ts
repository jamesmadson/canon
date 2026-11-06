import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { skillSchema } from '../../src/content/skillSchema';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillsDir = path.join(__dirname, '../../src/content/skills');
const publicDir = path.join(__dirname, '../../public');
const files = readdirSync(skillsDir).filter((f) => f.endsWith('.mdx'));

describe('seed content integrity', () => {
  it('has at least one skill file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} has valid frontmatter matching skillSchema`, () => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const { data } = matter(raw);
      expect(() => skillSchema.parse(data)).not.toThrow();
    });

    it(`${file}'s previewAssets resolve to real files in public/`, () => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const { data } = matter(raw);
      const parsed = skillSchema.parse(data);
      for (const asset of parsed.previewAssets) {
        const assetPath = path.join(publicDir, asset);
        expect(existsSync(assetPath), `${asset} referenced by ${file} does not exist`).toBe(true);
      }
    });

    // A page preview is a real Graft page, so it must be one made with
    // --public: no fork command, no session or message ids, no home folder.
    it(`${file}'s page previews were made with --public`, () => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const parsed = skillSchema.parse(matter(raw).data);
      if (parsed.previewType !== 'page') return;
      for (const asset of parsed.previewAssets) {
        const page = readFileSync(path.join(publicDir, asset), 'utf-8');
        expect(page, `${asset} offers a fork command`).not.toContain('Copy fork command');
        expect(page, `${asset} carries an id`).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        expect(page, `${asset} names a home folder`).not.toMatch(/\/Users\/|\/home\/|\/private\/tmp\//);
      }
    });

    // Previews are real runs on a made-up team, and Strata keeps the real
    // names in participants.local.md. Neither that file nor an address in it
    // may reach the site.
    it(`${file}'s previews carry no email address and no participants file`, () => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const parsed = skillSchema.parse(matter(raw).data);
      for (const asset of parsed.previewAssets) {
        expect(asset).not.toMatch(/participants/);
        if (parsed.previewType === 'image') continue;
        const text = readFileSync(path.join(publicDir, asset), 'utf-8');
        expect(text, `${asset} carries an email address`).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
      }
    });

    it(`${file}'s fileTree has exactly one SKILL.md entry`, () => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const { data } = matter(raw);
      const parsed = skillSchema.parse(data);
      const skillMdEntries = parsed.fileTree.filter((entry) => entry.path.split('/').pop() === 'SKILL.md');
      expect(skillMdEntries, `${file} should have exactly one SKILL.md entry in fileTree`).toHaveLength(1);
    });
  }

  it('has unique slugs across all skill files', () => {
    const slugs = files.map((file) => {
      const raw = readFileSync(path.join(skillsDir, file), 'utf-8');
      const { data } = matter(raw);
      return data.slug;
    });
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
