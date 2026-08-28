import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const marketplace = JSON.parse(
  readFileSync(path.join(root, '.claude-plugin/marketplace.json'), 'utf-8')
);

describe('plugin marketplace', () => {
  it('lists at least one plugin', () => {
    expect(Array.isArray(marketplace.plugins)).toBe(true);
    expect(marketplace.plugins.length).toBeGreaterThan(0);
  });

  it('has unique plugin names', () => {
    const names = marketplace.plugins.map((p: { name: string }) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const plugin of marketplace.plugins as { name: string; source: string }[]) {
    // A marketplace entry pointing at a directory that does not exist installs
    // nothing and fails only on the user's machine.
    it(`${plugin.name}: its source directory exists`, () => {
      const dir = path.join(root, plugin.source);
      expect(existsSync(dir), `${plugin.source} is missing`).toBe(true);
    });

    it(`${plugin.name}: ships a plugin.json whose name matches the listing`, () => {
      const manifestPath = path.join(root, plugin.source, '.claude-plugin/plugin.json');
      expect(existsSync(manifestPath), `${manifestPath} is missing`).toBe(true);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      expect(manifest.name).toBe(plugin.name);
      expect(typeof manifest.description).toBe('string');
    });

    it(`${plugin.name}: every skill it ships has frontmatter with a name`, () => {
      const skillsDir = path.join(root, plugin.source, 'skills');
      expect(existsSync(skillsDir), `${plugin.source}/skills is missing`).toBe(true);

      const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
      expect(skillDirs.length).toBeGreaterThan(0);

      for (const skill of skillDirs) {
        const file = path.join(skillsDir, skill, 'SKILL.md');
        expect(existsSync(file), `${skill} has no SKILL.md`).toBe(true);
        const raw = readFileSync(file, 'utf-8');
        expect(raw.startsWith('---\n'), `${skill} has no frontmatter`).toBe(true);
        expect(raw).toMatch(/\nname:\s*\S+/);
      }
    });
  }
});
