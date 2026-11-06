import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const skillsDir = path.join(root, 'src/content/skills');
const files = readdirSync(skillsDir).filter((f) => f.endsWith('.mdx'));
const page = readFileSync(path.join(root, 'src/pages/skills/[slug].astro'), 'utf-8');

describe('a skill page is a run page', () => {
  it('has the four skills', () => {
    expect(files.sort()).toEqual(['graft.mdx', 'lath.mdx', 'prune.mdx', 'strata.mdx']);
  });

  for (const file of files) {
    const data = matter(readFileSync(path.join(skillsDir, file), 'utf-8')).data;

    // Mutation: deleting `prompt` from lath.mdx fails this.
    it(`${file} carries the prompt that made its preview`, () => {
      expect(typeof data.prompt).toBe('string');
      expect(data.prompt.length).toBeGreaterThan(20);
    });

    // Mutation: adding a fifth line, or deleting two, to any notice list fails this.
    it(`${file} has two to four notice lines, each under 120 characters, with no dashes`, () => {
      expect(Array.isArray(data.notice)).toBe(true);
      expect(data.notice.length).toBeGreaterThanOrEqual(2);
      expect(data.notice.length).toBeLessThanOrEqual(4);
      for (const line of data.notice) {
        expect(line.length, line).toBeLessThan(120);
        expect(line, line).not.toMatch(/[–—]/);
      }
    });

    // Mutation: deleting `next` from prune.mdx fails this.
    it(`${file} says what to do with the output`, () => {
      expect(typeof data.next).toBe('string');
      expect(data.next.trim().length).toBeGreaterThan(20);
    });
  }

  // Mutation: putting a real session id in graft.mdx's prompt fails this.
  it('keeps real session ids and home folders out of every prompt', () => {
    for (const file of files) {
      const { prompt } = matter(readFileSync(path.join(skillsDir, file), 'utf-8')).data;
      expect(prompt, file).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      expect(prompt, file).not.toMatch(/\/Users\/|\/home\/|\/private\/tmp\//);
    }
    const graft = matter(readFileSync(path.join(skillsDir, 'graft.mdx'), 'utf-8')).data;
    expect(graft.prompt).toContain('<session id>');
  });

  // Mutation: removing `subject` from prune.mdx fails this.
  it("Prune's subject is a page that exists in public/", () => {
    const prune = matter(readFileSync(path.join(skillsDir, 'prune.mdx'), 'utf-8')).data;
    expect(prune.subject).toBe('/previews/prune/pricing.html');
    expect(existsSync(path.join(root, 'public', prune.subject))).toBe(true);
  });

  // Mutation: restoring a "Depth" heading in [slug].astro fails this.
  it('the page template has the run sections in order and none of the gallery', () => {
    const order = ['What to say', 'What it made', 'What to notice', 'What to do with it'];
    const at = order.map((h) => page.indexOf(h));
    expect(at.every((i) => i >= 0), order.join(', ')).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(page).toContain('What it reviewed');
    for (const gone of ['Depth', 'Last verified', 'StructureMap', 'ToolBadge', 'Categories']) {
      expect(page, gone).not.toContain(gone);
    }
  });
});
