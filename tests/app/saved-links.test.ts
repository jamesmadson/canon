// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { currentAddress } from '../../src/app/lib/nav';

describe('opening a saved link', () => {
  it('moves an old board link to the prototype view in place, without a history entry', () => {
    const before = history.length;
    history.replaceState(null, '', '#/b/b1/f/f1');
    expect(currentAddress()).toEqual({ name: 'full', frame: 'f1', board: null, width: null, path: null });
    expect(location.hash).toBe('#/f/f1/full');
    history.replaceState(null, '', '#/b/b1/f/f1/full?w=390');
    expect(currentAddress()).toMatchObject({ name: 'full', frame: 'f1', board: null, width: 390 });
    expect(location.hash).toBe('#/f/f1/full?w=390');
    expect(history.length).toBe(before);
  });

  it('leaves the board full-screen view the app opened itself', () => {
    history.replaceState({ canonFrom: true }, '', '#/b/b1/f/f1/full');
    expect(currentAddress()).toMatchObject({ name: 'full', board: 'b1' });
    expect(location.hash).toBe('#/b/b1/f/f1/full');
  });

  it('leaves a board link alone', () => {
    history.replaceState(null, '', '#/b/b1');
    expect(currentAddress()).toEqual({ name: 'board', board: 'b1', frame: null });
    expect(location.hash).toBe('#/b/b1');
  });
});
