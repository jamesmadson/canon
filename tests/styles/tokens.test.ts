import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
const layout = readFileSync(join(root, 'src/layouts/BaseLayout.astro'), 'utf8');

// The site's colours (D-133 replaces the CLAUDE.md table for the site): token, light, dark. Orange and pin are the same in both.
const TABLE: Array<[string, string, string]> = [
  ['--color-ground', '#FFFFFF', '#151413'],
  ['--color-panel', '#F6F3F0', '#1F1E1C'],
  ['--color-recess', '#EAE6E2', '#2E2D2A'],
  ['--color-fill-2', '#F0ECE9', '#262522'],
  ['--color-ink', '#1A1918', '#EDEBE6'],
  ['--color-ink-soft', '#5C5954', '#A29E96'],
  ['--color-input-border', '#85817A', '#77736B'],
  ['--color-orange', '#FF4F00', '#FF4F00'],
  ['--color-pin', '#B83A00', '#B83A00'],
];

// Every declaration of a token in the file, in order.
function values(token: string): string[] {
  const re = new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`, 'g');
  return [...css.matchAll(re)].map((m) => m[1].toUpperCase());
}

describe('site tokens', () => {
  for (const [token, light, dark] of TABLE) {
    // Mutation: change this token's light hex in global.css to any other value.
    it(`${token} carries the light value ${light}`, () => {
      expect(values(token)).toContain(light);
    });
    // Mutation: put a dark value back into global.css.
    it(`${token} has no dark value`, () => {
      if (dark !== light) expect(values(token)).not.toContain(dark);
    });
  }

  it('has none of the old near-miss colours', () => {
    // Mutation: reintroduce #ff4b12 anywhere in global.css.
    for (const old of ['#ff4b12', '#ff5c28', '#e9b824', '#f0c441', '#eeede9', '#171814']) {
      expect(css.toLowerCase()).not.toContain(old);
      expect(layout.toLowerCase()).not.toContain(old);
    }
  });
});

describe('BaseLayout theme', () => {
  it('is light only', () => {
    // Mutation: bring back data-app-theme, a dark theme-color or a dark colour-scheme.
    expect(layout).not.toContain('data-app-theme');
    expect(layout).toContain('<meta name="color-scheme" content="light" />');
    expect(layout).toMatch(/name="theme-color" content="#FFFFFF" \/>/);
    expect(layout).not.toContain('prefers-color-scheme');
    expect(css).toMatch(/:root \{\s*\/\*[^*]*\*\/\s*color-scheme: light;/);
  });
});
