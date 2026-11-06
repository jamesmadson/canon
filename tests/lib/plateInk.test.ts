import { describe, expect, it } from 'vitest';
import { contrast, plateInk } from '../../src/lib/plateInk';

describe('plateInk', () => {
  // Mutation: in plateInk.ts, change `>=` to `<` in plateInk.
  it('puts white on a strong blue and ink on a pale yellow', () => {
    expect(plateInk('#3366ff')).toBe('#FFFFFF');
    expect(plateInk('#ffe066')).toBe('#1A1918');
  });

  // Mutation: in plateInk.ts, change `(hi + 0.05) / (lo + 0.05)` to `(lo + 0.05) / (hi + 0.05)`.
  it('measures contrast the WCAG way, larger first', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
  });

  it('reads Fieldwork’s letter at 4.5:1 or more', () => {
    expect(contrast('#3366ff', plateInk('#3366ff'))).toBeGreaterThanOrEqual(4.5);
  });
});
