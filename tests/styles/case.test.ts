import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');

// Every file under the four site folders. src/app is its own folder and is not listed.
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

const sources = ['src/styles', 'src/components', 'src/layouts', 'src/pages']
  .flatMap((d) => files(join(root, d)))
  .filter((f) => /\.(css|astro|ts|js|mjs)$/.test(f));

describe('sentence case', () => {
  it('reads some files', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('uses no text-transform: uppercase', () => {
    // Mutation: add text-transform: uppercase to .label in global.css.
    const hits = sources.filter((f) => /text-transform:\s*uppercase/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('uses no Tailwind uppercase class', () => {
    // Mutation: add `uppercase` to a class attribute in src/pages/skills/[slug].astro.
    const re = /class(Name)?=(?:"[^"]*|'[^']*|\{[^}]*)\buppercase\b/;
    const hits = sources.filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});
