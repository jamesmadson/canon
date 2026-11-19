import { describe, expect, it } from 'vitest';
import { body, css } from './helpers/css';

const root = body(css, /:root\s*\{/);
const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(root)?.[1].trim();
const rule = (selector: string) => body(css, new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'm'));

describe('type scale (D-138)', () => {
  it('sets the scale in tokens', () => {
    expect(token('--fs-base')).toBe('15px');
    expect(token('--lh-base')).toBe('22px');
    expect(token('--fs-name')).toBe('16px');
    expect(token('--fs-title')).toBe('20px');
    expect(token('--fs-meta')).toBe('13px');
    expect(token('--ls-text')).toBe('-0.01em');
    expect(token('--ls-title')).toBe('-0.02em');
  });

  it('sets the control and row heights in tokens', () => {
    expect(token('--h-ctl')).toBe('36px');
    expect(token('--h-ctl-lg')).toBe('44px');
    expect(token('--h-row')).toBe('48px');
    expect(token('--h-nav')).toBe('36px');
    expect(token('--h-chip')).toBe('32px');
  });

  it('reads the body from the tokens', () => {
    const b = rule('body');
    expect(b).toMatch(/font: 400 var\(--fs-base\)\/var\(--lh-base\)/);
    expect(b).toMatch(/letter-spacing: var\(--ls-text\)/);
  });

  it('gives buttons 36px, primary actions and dialogs 44px', () => {
    expect(rule('.btn')).toMatch(/height: var\(--h-ctl\)/);
    expect(rule('.add')).toMatch(/height: var\(--h-ctl-lg\)/);
    expect(css).toMatch(/\.dialog \.btn[^{]*\{[^}]*height: var\(--h-ctl-lg\)/);
    expect(css).toMatch(/\.dialog \.field\s*\{[^}]*min-height: var\(--h-ctl-lg\)/);
  });

  it('gives rows 48px and sidebar items 36px', () => {
    expect(rule('.prow')).toMatch(/height: var\(--h-row\)/);
    expect(rule('.ni')).toMatch(/height: var\(--h-nav\)/);
  });

  it('keeps meta and mono at 13px with no letter spacing, and names at 16px medium', () => {
    expect(rule('.prow .when')).toMatch(/font-size: var\(--fs-meta\); letter-spacing: 0/);
    expect(rule('.prow .nm')).toMatch(/font-weight: 500; font-size: var\(--fs-name\)/);
  });

  it('hard-codes no text size below 13px except the small numbers inside pins and avatars', () => {
    const small = [...css.matchAll(/(?:font-size:|font:\s*\d+)\s*(\d+(?:\.\d+)?)px/g)].filter((m) => Number(m[1]) < 13);
    const lines = small.map((m) => css.slice(css.lastIndexOf('\n', m.index) + 1, css.indexOf('\n', m.index)));
    for (const l of lines) expect(l, l).toMatch(/\.pin|font: (600|700) (11|10\.5|9)px/);
  });
});
