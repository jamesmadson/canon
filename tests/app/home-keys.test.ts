import { describe, expect, it } from 'vitest';
import { isSearchHotkey, moveSelection } from '../../src/app/lib/keys';

describe('moveSelection', () => {
  it('moves one row with the arrow keys and stops at the ends', () => {
    expect(moveSelection(0, 5, 'ArrowDown')).toBe(1);
    expect(moveSelection(4, 5, 'ArrowDown')).toBe(4);
    expect(moveSelection(2, 5, 'ArrowUp')).toBe(1);
    expect(moveSelection(0, 5, 'ArrowUp')).toBe(0);
  });
  it('jumps to the ends with Home and End', () => {
    expect(moveSelection(2, 5, 'Home')).toBe(0);
    expect(moveSelection(2, 5, 'End')).toBe(4);
  });
  it('leaves the row alone for any other key, and for an empty list', () => {
    expect(moveSelection(2, 5, 'a')).toBe(2);
    expect(moveSelection(0, 0, 'ArrowDown')).toBe(0);
  });
  it('brings an out of range row back into range', () => {
    expect(moveSelection(9, 3, 'ArrowUp')).toBe(1);
  });
});

describe('isSearchHotkey', () => {
  const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) =>
    ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });
  it('is Command or Control and K', () => {
    expect(isSearchHotkey(key('k', { metaKey: true }))).toBe(true);
    expect(isSearchHotkey(key('K', { ctrlKey: true }))).toBe(true);
  });
  it('is not K alone, or with Alt or Shift', () => {
    expect(isSearchHotkey(key('k'))).toBe(false);
    expect(isSearchHotkey(key('k', { metaKey: true, altKey: true }))).toBe(false);
    expect(isSearchHotkey(key('k', { metaKey: true, shiftKey: true }))).toBe(false);
  });
});
