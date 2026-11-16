import { describe, expect, it } from 'vitest';
import { body, css } from './helpers/css';

const home = css.slice(css.indexOf('/* ── Home screen'));

describe('the home screen styles', () => {
  it('puts every hover rule behind a fine pointer', () => {
    expect(home.length).toBeGreaterThan(1000);
    let rest = home;
    const fine = /@media \(hover: hover\) and \(pointer: fine\)\s*\{/;
    for (let m = fine.exec(rest); m; m = fine.exec(rest)) {
      const inner = body(rest, fine);
      rest = rest.slice(0, m.index) + rest.slice(m.index + m[0].length + inner.length + 1);
    }
    expect(rest).not.toMatch(/:hover/);
  });

  it('uses the one easing curve and only transform and opacity for the arrival', () => {
    const arrival = home.slice(home.indexOf('@keyframes slide-in'), home.indexOf('@media (hover'));
    expect(arrival).not.toMatch(/cubic-bezier/);
    const declared = arrival.match(/animation:[^;}]*/g) ?? [];
    expect(declared.length).toBeGreaterThan(8);
    for (const d of declared) expect(d).toContain('var(--ease)');
    for (const frames of home.matchAll(/@keyframes [\w-]+\s*\{([\s\S]*?)\}\s*(?=@keyframes|\.)/g)) {
      expect(frames[1]).not.toMatch(/\b(width|height|top|left|margin|padding|background|box-shadow)\s*:/);
    }
  });

  it('times the drop as the design does: slide 400ms, pull 300ms, parts 400ms, text after', () => {
    expect(home).toMatch(/\.cards\.arriving > \.scard:not\(\.arriving\) \{ animation: slide-in 400ms/);
    expect(home).toMatch(/\.zip \.pull \{[^}]*pull-run 300ms/);
    expect(home).toMatch(/\.zip \.zl \{[^}]*part-left 400ms var\(--ease\) 800ms/);
    expect(home).toMatch(/\.zip \.zr \{[^}]*part-right 400ms var\(--ease\) 800ms/);
    expect(home).toMatch(/\.scard\.zipped \.th \{ animation: appear 400ms var\(--ease\) 800ms/);
    expect(home).toMatch(/\.scard\.zipped \.cname \{ animation: rise 240ms var\(--ease\) 1200ms/);
  });

  it('skips to the finished card when motion is reduced', () => {
    const reduced = body(home.slice(home.lastIndexOf('@media (prefers-reduced-motion: reduce)')), /@media \(prefers-reduced-motion: reduce\)/);
    expect(reduced).toMatch(/\.zip \{ display: none; \}/);
    expect(reduced).toMatch(/\.cards\.arriving > \.scard:not\(\.arriving\)[^}]*animation: none/);
    expect(reduced).toMatch(/\.scard\.zipped \.th[^}]*animation: none/);
  });

  it('scales to 0.97 when pressed', () => {
    for (const sel of ['.add', '.util', '.st', '.ibtn', '.find']) expect(home).toContain(`${sel}:active { transform: scale(0.97); }`);
  });

  it('marks the selected row and card in orange and nothing else on the screen', () => {
    const orange = home.split('\n').filter((l) => /var\(--accent\)/.test(l));
    expect(orange.length).toBeGreaterThan(0);
    for (const l of orange) expect(l).toMatch(/\.sel\b|\.switcher li\.on/);
  });
});
