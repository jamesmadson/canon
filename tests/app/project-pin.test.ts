// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, saved: [] as { name: string; value: any }[] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.saved.push({ name, value }); },
}));

import * as store from '../../src/app/store';
import { orderProjects } from '../../src/app/lib/projects';
import { ProjectView, pinLabel } from '../../src/app/ui';
import { clear, click, mount, project } from './helpers/dom';

const seed = (projects: unknown[]) => {
  db.saved = [];
  db.lists = { projects, boards: [], placements: [], notes: [], frames: [] };
};
const names = (list: { name: string }[]) => list.map((p) => p.name);

afterEach(clear);

describe('pinning a project', () => {
  it('pins and unpins through the store and saves each change', async () => {
    seed([project('p1', 'Pricing')]);
    await store.load();
    expect(await store.pinProject('p1', true)).toBe(true);
    expect(store.getState().projects[0].pinned).toBe(true);
    expect(db.saved.at(-1)).toMatchObject({ name: 'projects', value: { id: 'p1', pinned: true, updatedAt: 1 } });
    await store.pinProject('p1', false);
    expect(store.getState().projects[0].pinned).toBe(false);
    expect(db.saved.at(-1)!.value.pinned).toBe(false);
    expect(await store.pinProject('nope', true)).toBe(false);
  });

  it('loads older projects that have no pinned field', async () => {
    seed([project('p1', 'Pricing')]);
    await store.load();
    expect(store.getState().projects[0].pinned).toBeUndefined();
    expect(names(orderProjects(store.getState().projects))).toEqual(['Pricing']);
  });

  it('puts pinned projects first and keeps recent-first order inside each group', () => {
    const list = [
      project('a', 'A', 5), project('b', 'B', 4), { ...project('c', 'C', 1), pinned: true },
      project('d', 'D', 3), { ...project('e', 'E', 2), pinned: true },
    ];
    expect(names(orderProjects(list))).toEqual(['E', 'C', 'A', 'B', 'D']);
    expect(names(orderProjects(list.map((p) => ({ ...p, pinned: false }))))).toEqual(['A', 'B', 'D', 'E', 'C']);
  });

  it('labels the project menu item Pin to top, then Unpin', async () => {
    expect(pinLabel(false)).toBe('Pin to top');
    expect(pinLabel(true)).toBe('Unpin');
    seed([project('p1', 'Pricing')]);
    await store.load();
    const box = await mount(ProjectView, { id: 'p1', tab: 'prototypes' as const, askUrl: async () => null });
    await click(box.querySelector('button.more')!);
    const item = box.querySelector('[role="menuitem"]')!;
    expect(item.textContent).toBe('Pin to top');
    await click(item);
    expect(store.getState().projects[0].pinned).toBe(true);
    await click(box.querySelector('button.more')!);
    expect(box.querySelector('[role="menuitem"]')!.textContent).toBe('Unpin');
  });
});
