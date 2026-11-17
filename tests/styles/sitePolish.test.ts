import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const css = read('src/styles/global.css');

describe('the Lath preview', () => {
  const html = read('public/previews/lath/checkout-payment.html');
  // Mutation: restore --pin:#B83A00 or white numbers.
  it('pins in Canon orange with ink numbers', () => {
    expect(html).toContain('--pin:#FF4F00;');
    expect(html).toContain('background:var(--pin);color:#1A1918;');
  });
});

describe('review fixes', () => {
  const read2 = (p: string) => readFileSync(join(root, p), 'utf8');
  const app = read2('src/app/app.css');
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const token = (name: string, from = app) => from.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`))![1];

  // Mutation: darken --faint, or lighten the rail's hover fill, until small text drops under 4.5:1.
  it('keeps faint and muted text at 4.5:1 on every app surface, rail hover included, in light and dark', () => {
    const dark = app.slice(app.indexOf('@media (prefers-color-scheme: dark)'));
    const light = app.slice(0, app.indexOf('@media (prefers-color-scheme: dark)'));
    for (const scheme of [light, dark]) {
      const surfaces = ['--bg', '--ground', '--panel', '--raised', '--hover', '--rail-hover'].map((t) => token(t, scheme));
      for (const text of [token('--faint', scheme), token('--soft', scheme)]) {
        for (const s of surfaces) expect(ratio(text, s), `${text} on ${s}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  // Mutation: paint a status dot in the accent again.
  it('keeps orange off the app status dots and the drop overlay', () => {
    expect(app).not.toMatch(/\.agent \.dot\[data-state="on"\][^}]*accent/);
    expect(app).not.toMatch(/\.store-line\.warn \.dot[^}]*accent/);
    expect(app.slice(app.indexOf('.dropzone {'), app.indexOf('}', app.indexOf('.dropzone {')))).not.toMatch(/accent|255,79,0/);
  });

  // Mutation: take the try/catch off openTry in boot, so a failed sample blanks the page.
  it('draws the app even when the sample fails to load', () => {
    const main = read2('src/app/main.ts');
    expect(main).toMatch(/try \{\s*await openTry\(tryAtLoad\);\s*\} catch \(err\) \{[\s\S]*toast\('The sample project could not be loaded/);
    expect(main.indexOf('await openTry(tryAtLoad)')).toBeLessThan(main.indexOf('render(h(App'));
  });
});
