import { describe, expect, it } from 'vitest';
import { body, css } from './helpers/css';

function tokens(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of text.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  return out;
}

const light = tokens(body(css, /:root\s*\{/));
const dark = tokens(body(body(css, /@media \(prefers-color-scheme: dark\)\s*\{/), /:root\s*\{/));

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const COLOURS = ['--bg', '--ground', '--rail', '--panel', '--raised', '--hover', '--press', '--line', '--line-strong', '--text', '--soft', '--faint', '--input-border', '--accent', '--pin', '--pop', '--canvas', '--focus'];

describe('colour tokens', () => {
  it('light and dark both define every colour the app reads', () => {
    for (const t of COLOURS) {
      expect(light[t], `light ${t}`).toBeTruthy();
      expect(dark[t], `dark ${t}`).toBeTruthy();
    }
  });

  it('uses the approved palette', () => {
    expect(light['--ground'].toUpperCase()).toBe('#FFFFFF');
    expect(light['--bg'].toUpperCase()).toBe('#F7F5F2');
    expect(light['--text'].toUpperCase()).toBe('#1A1918');
    expect(dark['--ground'].toUpperCase()).toBe('#1C1B19');
    expect(dark['--bg'].toUpperCase()).toBe('#151413');
    expect(dark['--text'].toUpperCase()).toBe('#EDEBE6');
    expect(light['--accent'].toUpperCase()).toBe('#FF4F00');
    expect(dark['--accent'].toUpperCase()).toBe('#FF4F00');
  });

  for (const [scheme, t] of [['light', light], ['dark', dark]] as const) {
    it(`${scheme}: text reaches 4.5:1 on every surface it sits on`, () => {
      for (const fg of ['--text', '--soft', '--faint']) {
        for (const bg of ['--bg', '--ground', '--panel', '--raised', '--pop']) {
          expect(ratio(t[fg], t[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`${scheme}: input borders reach 3:1 on the surfaces they sit on`, () => {
      for (const bg of ['--ground', '--panel', '--raised', '--pop']) {
        expect(ratio(t['--input-border'], t[bg]), `border on ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${scheme}: the focus ring reaches 3:1 on the ground and the sidebar`, () => {
      expect(ratio(t['--focus'], t['--ground'])).toBeGreaterThanOrEqual(3);
      expect(ratio(t['--focus'], t['--bg'])).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('focus, type and motion', () => {
  it('draws a visible focus ring on everything focusable', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus\)/);
  });

  it('puts Geist first and ships it from the app, not a CDN', () => {
    expect(css).toMatch(/font-family:\s*"Geist"/);
    expect(light['--sans']).toMatch(/^"Geist"/);
    expect(css).not.toMatch(/https?:\/\//);
  });

  it('follows the system colour scheme', () => {
    expect(css).toMatch(/color-scheme:\s*light dark/);
  });

  it('uses one easing curve', () => {
    expect(light['--ease']).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
