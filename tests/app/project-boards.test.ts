// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { Library, ProjectView } from '../../src/app/ui';
import { clear, click, frame, mount, project } from './helpers/dom';

const board = (id: string, name: string) => ({ id, projectId: 'p1', name, createdAt: 1, updatedAt: 1, arrangement: 'free' });
const place = (id: string, boardId: string, frameId: string) => ({ id, boardId, frameId, x: 0, y: 0 });

const seed = (boards: ReturnType<typeof board>[]) => {
  db.writes = [];
  db.lists = {
    projects: [project('p1', 'Pricing')],
    boards,
    placements: [place('1', 'b1', 'a'), place('2', 'b2', 'b'), place('3', 'b1', 'c'), place('4', 'b2', 'c')],
    notes: [],
    frames: [
      frame({ id: 'a', name: 'Annual toggle', createdAt: 3, updatedAt: 3 }),
      frame({ id: 'b', name: 'Three tiers', createdAt: 2, updatedAt: 2 }),
      frame({ id: 'c', name: 'Both boards', createdAt: 1, updatedAt: 1, pages: ['index.html', 'a.html', 'b.html', 'c.html'] }),
      frame({ id: 'd', name: 'Loose one', createdAt: 0, updatedAt: 0 }),
    ],
  };
};
const two = () => seed([board('b1', 'Explorations'), board('b2', 'Round two')]);

afterEach(clear);

const lib = async (view: 'grid' | 'list' = 'grid') => {
  localStorage.setItem('canon-project-view', view);
  await store.load();
  return mount(Library, { projectId: 'p1', askUrl: async () => null });
};
const names = (box: HTMLElement) => Array.from(box.querySelectorAll('[data-card] .nm, [data-card] .meta b')).map((n) => n.textContent);
const chips = (box: HTMLElement) => Array.from(box.querySelectorAll<HTMLButtonElement>('.board-chips button'));

describe('boards in the project view', () => {
  beforeEach(two);

  it('shows each prototype’s board names in the grid when the project has more than one board', async () => {
    const box = await lib('grid');
    expect(box.querySelector('[data-card="a"]')!.textContent).toContain('Explorations');
    expect(box.querySelector('[data-card="c"]')!.textContent).toContain('Explorations, Round two');
  });

  it('shows them in the list too, as a quiet item', async () => {
    const box = await lib('list');
    expect(box.querySelector('[data-card="b"] .brd')!.textContent).toBe('Round two');
    expect(box.querySelector('[data-card="c"] .brd')!.textContent).toBe('Explorations, Round two');
  });

  it('has a chip row to show one board, and one to show all again', async () => {
    const box = await lib('grid');
    expect(chips(box).map((b) => b.textContent)).toEqual(['All boards', 'Explorations', 'Round two']);
    expect(chips(box)[0].getAttribute('aria-pressed')).toBe('true');
    await click(chips(box)[2]);
    expect(names(box).sort()).toEqual(['Both boards', 'Three tiers']);
    expect(chips(box)[2].getAttribute('aria-pressed')).toBe('true');
    expect(chips(box)[0].getAttribute('aria-pressed')).toBe('false');
    await click(chips(box)[0]);
    expect(names(box)).toHaveLength(4);
  });
});

describe('with one board or none', () => {
  it('shows no board names and no chip row', async () => {
    seed([board('b1', 'Explorations')]);
    const box = await lib('list');
    expect(box.querySelector('.board-chips')).toBeNull();
    expect(box.querySelector('.brd')).toBeNull();
  });
  it('shows no chip row when there are no boards', async () => {
    seed([]);
    db.lists.placements = [];
    const box = await lib('grid');
    expect(box.querySelector('.board-chips')).toBeNull();
  });
});

describe('the Boards tab', () => {
  it('says what boards are, at the top', async () => {
    two();
    await store.load();
    const box = await mount(ProjectView, { id: 'p1', tab: 'boards' as const, askUrl: async () => null });
    const note = box.querySelector('.boards-note')!;
    expect(note.textContent?.replace(/ /g, ' ')).toBe('Boards lay prototypes side by side. Agents file new prototypes onto a board.');
    expect(note.nextElementSibling?.classList.contains('grid')).toBe(true);
  });
});

describe('a grid card counts pages and versions the way rows and shelves do', () => {
  it('shows 4 pages, and both counts together', async () => {
    seed([board('b1', 'Explorations')]);
    (db.lists.frames as any[]).push(frame({ id: 'v1', name: 'Many', stackId: 'v1', pages: ['index.html', 'a.html', 'b.html', 'c.html'], createdAt: 5, updatedAt: 5 }), frame({ id: 'v2', name: 'Many 2', stackId: 'v1', pages: ['index.html', 'a.html', 'b.html', 'c.html'], createdAt: 6, updatedAt: 6 }));
    const box = await lib('grid');
    expect(box.querySelector('[data-card="c"] .lib-ver')!.textContent).toBe('4 pages');
    expect(box.querySelector('[data-card="v2"] .lib-ver')!.textContent).toBe('4 pages · 2 versions');
    expect(box.querySelector('[data-card="a"] .lib-ver')).toBeNull();
  });
});
