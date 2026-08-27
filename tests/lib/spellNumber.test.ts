import { describe, it, expect } from 'vitest';
import { spellNumber } from '../../src/lib/spellNumber';

describe('spellNumber', () => {
  it('spells the teens, where the pattern breaks', () => {
    expect(spellNumber(11)).toBe('eleven');
    expect(spellNumber(18)).toBe('eighteen');
    expect(spellNumber(19)).toBe('nineteen');
  });

  it('spells round tens without a trailing hyphen', () => {
    expect(spellNumber(20)).toBe('twenty');
    expect(spellNumber(90)).toBe('ninety');
  });

  it('hyphenates compound tens', () => {
    expect(spellNumber(21)).toBe('twenty-one');
    expect(spellNumber(47)).toBe('forty-seven');
  });

  it('falls back to digits outside 0-99 rather than guessing', () => {
    expect(spellNumber(100)).toBe('100');
    expect(spellNumber(-1)).toBe('-1');
    expect(spellNumber(3.5)).toBe('3.5');
  });
});
