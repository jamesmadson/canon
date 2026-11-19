import { describe, expect, it } from 'vitest';
import type { Frame } from '../../src/app/db';
import { cardsOf, countPrototypes, scopeCards } from '../../src/app/lib/home';
import { summarize, toLibrary } from '../../src/app/lib/backup';

const frame = (p: Partial<Frame> & { id: string }): Frame => ({
  projectId: 'p1', name: p.id, kind: 'files', x: 0, y: 0, w: 1280, h: 800, rev: 0, createdAt: 1, updatedAt: 1, ...p,
});

// Project p1: six prototypes. A has 3 versions, B has 2, C to F are single. One more archived prototype with 2 versions.
// Project p2: one prototype.
const frames: Frame[] = [
  frame({ id: 'a1', stackId: 'a1', createdAt: 1 }), frame({ id: 'a2', stackId: 'a1', createdAt: 2 }), frame({ id: 'a3', stackId: 'a1', createdAt: 3 }),
  frame({ id: 'b1', stackId: 'b1', createdAt: 1 }), frame({ id: 'b2', stackId: 'b1', createdAt: 2 }),
  frame({ id: 'c' }), frame({ id: 'd' }), frame({ id: 'e' }), frame({ id: 'f' }),
  frame({ id: 'x1', stackId: 'x1', createdAt: 1, archived: true }), frame({ id: 'x2', stackId: 'x1', createdAt: 2, archived: true }),
  frame({ id: 'o', projectId: 'p2' }),
];

describe('countPrototypes', () => {
  it('counts prototypes, not the versions stacked under them', () => {
    expect(frames.filter((f) => f.projectId === 'p1')).toHaveLength(11);
    expect(countPrototypes(frames, { projectId: 'p1' })).toBe(6);
  });
  it('counts the whole library the same way', () => {
    expect(countPrototypes(frames)).toBe(7);
  });
  it('leaves archived prototypes out, except in the archive count', () => {
    expect(countPrototypes(frames, { archived: true })).toBe(1);
    expect(countPrototypes(frames, { projectId: 'p2', archived: true })).toBe(0);
  });
  it('agrees with the cards Home shows for the project', () => {
    const home = scopeCards(cardsOf(frames.filter((f) => f.projectId === 'p1')), { kind: 'home' });
    expect(countPrototypes(frames, { projectId: 'p1' })).toBe(home.length);
  });
  it('counts an archived stack by its current version', () => {
    const mixed = [frame({ id: 'm1', stackId: 'm1', createdAt: 1, archived: true }), frame({ id: 'm2', stackId: 'm1', createdAt: 2 })];
    expect(countPrototypes(mixed)).toBe(1);
    expect(countPrototypes(mixed, { archived: true })).toBe(0);
  });
});

describe('the restore line', () => {
  it('counts prototypes, not versions', () => {
    const data = { projects: [{ id: 'p1', name: 'P', createdAt: 1, updatedAt: 1 }], boards: [], frames, placements: [], notes: [] } as any;
    expect(summarize(toLibrary(data, [], 1))).toBe('1 project, 8 prototypes, 0 notes');
  });
});
