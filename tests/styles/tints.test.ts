import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TINTS, tintOf } from '../../src/lib/thumbTints';
import { thumbTint, type ThumbKey } from '../../src/lib/thumbs';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const css = read('src/styles/tints.css');
const tokens = Object.fromEntries([...css.matchAll(/--tint-(\w+): (#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const sat = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return Math.max(...c) - Math.min(...c);
};

describe('the prototype tints', () => {
  it('are named once, in tints.css, and match the list the code picks from', () => {
    expect(Object.keys(tokens).sort()).toEqual([...TINTS].sort());
  });

  it('are low saturation and light, with no orange and no gradient', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      expect(sat(hex), name).toBeLessThan(0.14);
      expect(lum(hex), name).toBeGreaterThan(0.6);
    }
    expect(css).not.toMatch(/gradient|ff4f00/i);
  });

  it('keep the mini pages’ text at 4.5:1 or more', () => {
    for (const [name, hex] of Object.entries(tokens)) {
      expect(ratio('#1c1b19', hex), name).toBeGreaterThanOrEqual(4.5);
      expect(ratio('#5c5954', hex), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('give the nine drawn pages a tint each, with neighbours in the 3 by 3 hero grid differing', () => {
    const grid: ThumbKey[][] = [['w2', 'w1', 'w3'], ['w4', 'd1', 'd2'], ['d3', 'w5', 'm1']];
    for (const row of grid) for (const k of row) expect(TINTS).toContain(thumbTint(k));
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (c < 2) expect(thumbTint(grid[r][c]), `${r},${c} right`).not.toBe(thumbTint(grid[r][c + 1]));
        if (r < 2) expect(thumbTint(grid[r][c]), `${r},${c} below`).not.toBe(thumbTint(grid[r + 1][c]));
      }
    }
    expect(new Set(grid.flat().map(thumbTint)).size).toBeGreaterThanOrEqual(5);
  });

  it('colour the app’s placeholder by id, the same way each time and not as one grey', () => {
    expect(tintOf('abc123')).toBe(tintOf('abc123'));
    const ids = Array.from({ length: 24 }, (_, i) => `frame-${i}-${i * 7919}`);
    expect(new Set(ids.map(tintOf)).size).toBeGreaterThanOrEqual(4);
    const app = read('src/app/app.css');
    for (const t of TINTS) expect(app).toContain(`.th.tint-${t} { background: var(--tint-${t}); }`);
    expect(app).toContain('@import "../styles/tints.css"');
  });

  it('are read by the homepage thumbnails from the tokens, not their own colours', () => {
    const styles = read('src/components/home/HomeStyles.astro');
    for (const t of TINTS) expect(styles).toContain(`--tint: var(--tint-${t});`);
    expect(read('src/styles/global.css')).toContain('@import "./tints.css"');
  });
});
