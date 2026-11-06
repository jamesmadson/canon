import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8');
const layout = readFileSync(join(root, 'src/layouts/BaseLayout.astro'), 'utf8');

// The CLAUDE.md colour table: token, light, dark. Orange and pin are the same in both.
const TABLE: Array<[string, string, string]> = [
  ['--color-ground', '#E9E7E2', '#151413'],
  ['--color-panel', '#F5F4F1', '#1F1E1C'],
  ['--color-recess', '#DEDBD5', '#2E2D2A'],
  ['--color-fill-2', '#E4E2DD', '#262522'],
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
    // Mutation: change this token's dark hex in the dark blocks of global.css.
    it(`${token} carries the dark value ${dark}`, () => {
      expect(values(token)).toContain(dark);
    });
  }

  it('declares the dark values in both the explicit and the system block', () => {
    // Mutation: delete one of the two dark blocks, or change a hex in one only.
    const varying = TABLE.filter(([, light, dark]) => light !== dark);
    for (const [token, , dark] of varying) {
      expect(values(token).filter((v) => v === dark).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has none of the old near-miss colours', () => {
    // Mutation: reintroduce #ff4b12 anywhere in global.css.
    for (const old of ['#ff4b12', '#ff5c28', '#e9b824', '#f0c441', '#eeede9', '#171814']) {
      expect(css.toLowerCase()).not.toContain(old);
      expect(layout.toLowerCase()).not.toContain(old);
    }
  });
});

describe('BaseLayout theme', () => {
  it('follows the system theme', () => {
    // Mutation: set the attribute back to "dark" in BaseLayout.astro.
    expect(layout).toContain('data-app-theme="system"');
    expect(layout).not.toContain('data-app-theme="dark"');
  });

  it('sets the theme-color per scheme', () => {
    // Mutation: change either meta content or drop its media attribute.
    expect(layout).toMatch(/name="theme-color" content="#E9E7E2" media="\(prefers-color-scheme: light\)"/);
    expect(layout).toMatch(/name="theme-color" content="#151413" media="\(prefers-color-scheme: dark\)"/);
  });
});
