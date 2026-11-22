import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

const FILES = [
  'src/app/app.css',
  'src/styles/global.css',
  'src/components/home/HomeStyles.astro',
  'src/pages/skills/[slug].astro',
  'src/lib/cutDiff.ts',
];

describe('Canon blue (D-144)', () => {
  // Mutation: put #FF4F00 or #B83A00 back in any of these files.
  for (const f of FILES) {
    it(`${f} has no old orange`, () => {
      expect(read(f)).not.toMatch(/#FF4F00|#B83A00|255,\s*79,\s*0/i);
    });
  }

  it('the app light mode is cream with a white panel in both light blocks', () => {
    const css = read('src/app/app.css');
    for (const re of [/^:root\s*\{[^}]*\}/m, /:root\[data-theme="light"\]\s*\{[^}]*\}/]) {
      const block = css.match(re)![0];
      expect(block).toMatch(/--bg:\s*#F2EDDB/i);
      expect(block).toMatch(/--rail:\s*#F2EDDB/i);
      expect(block).toMatch(/--ground:\s*#FFFFFF/i);
      expect(block).toMatch(/--accent:\s*#007FFF/i);
    }
  });

  it('the mark dot reads the accent token', () => {
    expect(read('src/app/app.css')).toMatch(/\.mark::after\s*\{[^}]*background:\s*var\(--accent\)/);
  });
});
