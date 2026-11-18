// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { clampZoom, fitZoom, kindWord, neighbour, typingIn, versionLine, versionTitle } from '../../src/app/lib/viewer';

describe('versions in the viewer', () => {
  it('names the version only when there is more than one', () => {
    expect(versionTitle(3, 5)).toBe('Version 3 of 5');
    expect(versionTitle(1, 1)).toBe('');
  });
  it('steps to the version before or after, and stops at the ends', () => {
    const stack = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(neighbour(stack, 'b', -1)?.id).toBe('a');
    expect(neighbour(stack, 'b', 1)?.id).toBe('c');
    expect(neighbour(stack, 'a', -1)).toBeUndefined();
    expect(neighbour(stack, 'c', 1)).toBeUndefined();
    expect(neighbour(stack, 'zzz', 1)).toBeUndefined();
  });
  it('says what kind each version is and which is current', () => {
    const now = new Date(2026, 10, 18, 12).getTime();
    expect(kindWord({ kind: 'url' })).toBe('Link');
    expect(kindWord({ kind: 'files' })).toBe('Stored copy');
    expect(kindWord({ kind: 'linked' })).toBe('Stored copy');
    expect(versionLine(1, { kind: 'files', createdAt: now - 3600_000 }, false, now)).toBe('Version 1 · Today · Stored copy');
    expect(versionLine(2, { kind: 'url', createdAt: now - 86_400_000 }, true, now)).toBe('Version 2 · Yesterday · Link · Current');
  });
});

describe('zoom', () => {
  it('fits a wide page to the room and never enlarges', () => {
    expect(fitZoom(1280, 640)).toBe(0.5);
    expect(fitZoom(390, 1000)).toBe(1);
    expect(fitZoom(null, 300)).toBe(1);
    expect(fitZoom(5000, 100)).toBe(0.25);
  });
  it('clamps to a sensible range', () => {
    expect(clampZoom(9)).toBe(2);
    expect(clampZoom(0.01)).toBe(0.25);
  });
});

describe('arrow keys', () => {
  it('belong to fields, selects and open dialogs', () => {
    const input = document.createElement('input');
    const div = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const inner = document.createElement('button');
    dialog.appendChild(inner);
    expect(typingIn(input)).toBe(true);
    expect(typingIn(inner)).toBe(true);
    expect(typingIn(div)).toBe(false);
    expect(typingIn(null)).toBe(false);
  });
});
