import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { cardsOf, groupByProject, scopeCards } from '../../src/app/lib/home';
import { frame, project } from './helpers/dom';

beforeEach(async () => {
  db.writes = [];
  db.lists = {
    projects: [project('p1', 'One')], boards: [], placements: [], notes: [],
    frames: [
      frame({ id: 'old', name: 'Old one', stackId: 'old', createdAt: 1, updatedAt: 100 }),
      frame({ id: 'old2', name: 'Old one v2', stackId: 'old', createdAt: 2, updatedAt: 200 }),
      frame({ id: 'new', name: 'New one', createdAt: 3, updatedAt: 900 }),
    ],
  };
  await store.load();
});

const homeOrder = () => groupByProject(scopeCards(cardsOf(store.getState().frames), { kind: 'home' }), store.getState().projects)[0].cards.map((c) => c.id);

describe('star, note and archive are not updates', () => {
  it('starring leaves updatedAt and the place in Home alone', async () => {
    expect(homeOrder()).toEqual(['new', 'old2']);
    await store.setStarred('old', true);
    const f = store.getState().frames;
    expect(f.find((x) => x.id === 'old')!.updatedAt).toBe(100);
    expect(f.find((x) => x.id === 'old2')!.updatedAt).toBe(200);
    expect(f.every((x) => x.id === 'new' || x.starred)).toBe(true);
    expect(homeOrder()).toEqual(['new', 'old2']);
    expect(db.writes.every(([, v]) => v.updatedAt === 100 || v.updatedAt === 200)).toBe(true);
  });

  it('noting and archiving leave updatedAt alone too', async () => {
    await store.setNote('old', 'Ask Sam');
    await store.setArchived('old', true);
    for (const id of ['old', 'old2']) {
      const x = store.getState().frames.find((y) => y.id === id)!;
      expect(x.note).toBe('Ask Sam');
      expect(x.archived).toBe(true);
    }
    expect(store.getState().frames.find((x) => x.id === 'old')!.updatedAt).toBe(100);
    expect(store.getState().frames.find((x) => x.id === 'old2')!.updatedAt).toBe(200);
  });
});
