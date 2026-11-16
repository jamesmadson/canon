import { describe, expect, it } from 'vitest';
import { css } from './helpers/css';

describe('transitions in the home, project and bar styles', () => {
  const mine = css.slice(css.indexOf('/* ── Home screen'));

  it('name only transform or opacity', () => {
    const declared = [...mine.matchAll(/transition\s*:\s*([^;}]+)/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(5);
    for (const d of declared) {
      if (d.trim() === 'none') continue;
      for (const part of d.split(',')) expect(part.trim().split(/\s+/)[0], d).toMatch(/^(transform|opacity)$/);
    }
  });

  it('never use the all shorthand or a colour property', () => {
    expect(mine).not.toMatch(/transition[^;}]*\b(all|background|background-color|color|box-shadow|border-color)\b/);
  });
});
