import { describe, expect, it } from 'vitest';
import { css } from './helpers/css';

/** Every rule in the stylesheet as [selector, declarations]. Media blocks are flattened. */
function rules(source: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of source.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) out.push([m[1].trim(), m[2]]);
  return out;
}
const all = rules(css);
const specificity = (sel: string) => (sel.match(/\.|\[|:(?!:)/g) ?? []).length;

describe('the bar buttons are never orange when pressed', () => {
  const pressed = all.filter(([sel]) => sel.includes('[aria-pressed="true"]'));

  it('the winning pressed rule for the star and archive buttons is ink on a fill', () => {
    // The selector that reaches the bar group's buttons with the highest specificity, last in the file.
    const reaching = pressed.filter(([sel]) => sel.split(',').some((s) => /\.toolbar\b/.test(s) && /\.btn\b/.test(s)));
    const best = reaching.reduce((a, b) => (specificity(b[0]) >= specificity(a[0]) ? b : a));
    expect(best[0]).toContain('.bar-group');
    expect(best[1]).toMatch(/background:\s*var\(--raised\)/);
    expect(best[1]).toMatch(/color:\s*var\(--text\)/);
    expect(best[1]).not.toMatch(/accent|255,\s*79,\s*0|FF4F00/i);
  });

  it('beats every orange pressed rule that could reach those buttons', () => {
    const bar = pressed.find(([sel]) => sel.includes('.bar-group'))!;
    for (const [sel, decl] of pressed) {
      if (!/accent/.test(decl) || sel === bar[0]) continue;
      if (/\.toolbar/.test(sel)) expect(specificity(bar[0]), sel).toBeGreaterThan(specificity(sel));
    }
    expect(css.indexOf(bar[0])).toBeGreaterThan(css.indexOf('.toolbar .btn[aria-pressed="true"]'));
  });

  it('draws the star filled when starred', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/app/bar.ts', 'utf8')).toContain('<${Icon} name="star" fill=${!!frame?.starred} />');
  });
});
