import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

// Kit digests double as single-file agent skills: they are uploadable to
// Figma's custom-skills surface and anywhere else that accepts one Markdown
// file. That means their frontmatter must satisfy the Agent Skills spec
// (https://agentskills.io/specification). These tests encode the spec's
// constraints so the digests can't silently drift out of compliance.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const digestsDir = path.join(__dirname, '../../public/kits');

const digestFiles = readdirSync(digestsDir).filter((f) => f.endsWith('-digest.md'));

// name: 1-64 chars, lowercase alphanumeric and hyphens, no leading/trailing
// hyphen, no consecutive hyphens.
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('kit digests are valid single-file agent skills', () => {
  it('finds a digest for every kit', () => {
    expect(digestFiles.length).toBe(4);
  });

  for (const file of digestFiles) {
    const { data, content } = matter(readFileSync(path.join(digestsDir, file), 'utf-8'));

    it(`${file} has a spec-valid name`, () => {
      expect(typeof data.name).toBe('string');
      expect(data.name.length).toBeGreaterThan(0);
      expect(data.name.length).toBeLessThanOrEqual(64);
      expect(data.name, `"${data.name}" must be lowercase alphanumeric with single hyphens`).toMatch(
        NAME_PATTERN
      );
    });

    it(`${file}'s name derives from its kit slug`, () => {
      const slug = file.replace(/-digest\.md$/, '');
      expect(data.name).toBe(`canon-${slug}`);
      expect(data.metadata?.kit).toBe(slug);
    });

    it(`${file} has a spec-valid description`, () => {
      expect(typeof data.description).toBe('string');
      expect(data.description.trim().length).toBeGreaterThan(0);
      expect(data.description.length).toBeLessThanOrEqual(1024);
      // The spec asks descriptions to say when to use the skill, not just what
      // it is — that phrasing is what lets an agent match it to a task.
      expect(data.description.toLowerCase()).toContain('use when');
    });

    it(`${file}'s compatibility note stays within the spec's limit`, () => {
      expect(typeof data.compatibility).toBe('string');
      expect(data.compatibility.length).toBeLessThanOrEqual(500);
    });

    it(`${file} still has its body content below the frontmatter`, () => {
      expect(content.trim().length).toBeGreaterThan(500);
      expect(content).toContain('# ');
    });
  }
});
