import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf8');
const hero = read('src/components/home/HeroText.astro');
const styles = read('src/components/home/HomeStyles.astro');

const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const token = (name: string, from: number) => new RegExp(`${name}: (#[0-9a-f]{6})`, 'i').exec(hero.slice(from))![1];

describe('the Copy button in the inverted "Try the MCP" panel', () => {
  it('sets both background and colour on hover, so the site-wide hover cannot leak in', () => {
    const rule = /\.mcp-panel \.util:hover \{([^}]*)\}/.exec(hero)![1];
    expect(rule).toMatch(/background: var\(--mp-hover\)/);
    expect(rule).toMatch(/color: var\(--mp-ink\)/);
  });

  it('keeps at least 4.5:1 between its label and its hover background', () => {
    const light = hero.indexOf('.mcp {');
    expect(ratio(token('--mp-ink', light), token('--mp-hover', light))).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps the label on its panel colour at rest, and the hover distinct from the panel', () => {
    const light = hero.indexOf('.mcp {');
    for (const at of [light]) {
      const bg = /--mp-bg: (#[0-9a-f]{6})/i.exec(hero.slice(at))?.[1] ?? '#ffffff';
      expect(ratio(token('--mp-ink', at), bg)).toBeGreaterThanOrEqual(4.5);
      expect(token('--mp-hover', at).toLowerCase()).not.toBe(bg.toLowerCase());
    }
  });

  it('only the Copy state text changes in the Copied state, never a colour', () => {
    const script = read('src/scripts/home.ts');
    expect(script).not.toMatch(/button\.style\./);
  });
});

describe('the Copy button in the agent section', () => {
  it('sets colour with its hover background, on a recess it reads against', () => {
    const rule = /\n    \.util:hover \{([^}]*)\}/.exec(styles)![1];
    expect(rule).toMatch(/background: var\(--color-recess\)/);
    expect(rule).toMatch(/color: var\(--color-ink\)/);
    expect(ratio('#1A1918', '#EAE6E2')).toBeGreaterThanOrEqual(4.5);
    expect(ratio('#EDEBE6', '#2E2D2A')).toBeGreaterThanOrEqual(4.5);
  });
});
