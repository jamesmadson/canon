import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/app/app.css', 'utf8');
const shared = readFileSync('src/app/shared.ts', 'utf8');

// Every rule body that sets a padding-top of its own without a matching bottom.
const lopsided = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, , body]) => /(^|;)\s*padding-top:\s*1px/.test(body) && !/padding-bottom/.test(body))
  .map(([, sel]) => sel.trim());

describe('labels sit on the middle of their buttons', () => {
  it('has no one-pixel top nudge on buttons, which put labels below the middle', () => {
    expect(lopsided.filter((s) => /btn|button|\.find|\.add|\.seg|\.tabs|\.tag|chip/.test(s))).toEqual([]);
    expect(css).not.toMatch(/> svg \{ margin-top: -1px; \}/);
  });

  it('gives the sidebar footer buttons a fixed height and even block padding', () => {
    expect(css).toMatch(/\.foot-links button \{[^}]*height: 30px; padding: 0 12px;/);
    expect(css).toMatch(/\.store-tools button \{[^}]*align-items: center;[^}]*height: 30px; padding: 0 12px;/);
  });
});

describe('folder icons are drawn on the middle of their 16 grid', () => {
  // Top and bottom of each closed folder outline: top edge y, then height via v.
  const folder = (name: string) => {
    const d = shared.match(new RegExp(`  ${name}: '([^']+)'`))![1];
    const top = Number(d.match(/^M[\d.]+ ([\d.]+)/)![1]);
    const bottom = Number(d.match(/v([\d.]+)H/)![1]) + Number(d.match(/l[\d.]+ ([\d.]+)/)![1]) + top;
    return (top + bottom) / 2;
  };
  it.each(['project', 'move', 'folder'])('%s centres on 8', (name) => {
    expect(Math.abs(folder(name) - 8)).toBeLessThanOrEqual(0.5);
  });
});
