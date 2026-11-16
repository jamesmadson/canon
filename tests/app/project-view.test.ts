// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The real store runs over a fake database: it reads these lists and every write lands in `writes`.
const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { Library } from '../../src/app/ui';
import { clear, click, frame, mount, nameOf, project, unnamed } from './helpers/dom';

const T = 1_700_000_000_000;
const seed = () => {
  db.writes = [];
  db.lists = {
    projects: [project('p1', 'Pricing')],
    boards: [], placements: [], notes: [],
    frames: [
      frame({ id: 'a', name: 'Annual toggle', summary: 'Monthly and yearly.', tags: ['pricing', 'toggle'], tool: 'Claude Code', createdAt: T + 1, updatedAt: T + 5 }),
      frame({ id: 'b', name: 'Three tiers', tags: ['pricing'], starred: true, createdAt: T + 2, updatedAt: T + 3 }),
      frame({ id: 'c', name: 'Single plan', tags: ['table'], createdAt: T + 3, updatedAt: T + 9 }),
      frame({ id: 'd', name: 'Old idea', archived: true, createdAt: T + 4, updatedAt: T + 20 }),
      frame({ id: 'e1', name: 'Checkout', stackId: 'e1', createdAt: T + 5, updatedAt: T + 7 }),
      frame({ id: 'e2', name: 'Checkout v2', stackId: 'e1', createdAt: T + 6, updatedAt: T + 8 }),
    ],
  };
};

beforeEach(async () => { seed(); await store.load(); });
afterEach(clear);

const names = (box: HTMLElement) => Array.from(box.querySelectorAll('[data-card] .nm, [data-card] .meta b')).map((n) => n.textContent);
const pickOption = async (select: HTMLSelectElement, value: string) => {
  select.value = value;
  await (await import('preact/test-utils')).act(() => { select.dispatchEvent(new Event('change', { bubbles: true })); });
};
const lib = () => mount(Library, { projectId: 'p1', askUrl: async () => null });
const viewButton = (box: HTMLElement, label: string) => Array.from(box.querySelectorAll<HTMLButtonElement>('.seg button')).find((b) => b.textContent === label)!;

describe('the project view', () => {
  it('lists the prototypes as a grid by default, hiding archived ones, newest update first', async () => {
    const box = await lib();
    expect(box.querySelector('.lib-grid')).toBeTruthy();
    expect(names(box)).toEqual(['Single plan', 'Checkout v2', 'Annual toggle', 'Three tiers']);
  });

  it('sorts by starred first on request, then by update', async () => {
    const box = await lib();
    await pickOption(box.querySelector('select[aria-label="Sort"]')!, 'starred');
    expect(names(box)).toEqual(['Three tiers', 'Single plan', 'Checkout v2', 'Annual toggle']);
  });

  it('filters by tag, and clears the filter', async () => {
    const box = await lib();
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Filter'))!);
    const panel = box.querySelector('#filter-panel')!;
    expect(Array.from(panel.querySelectorAll('button[aria-pressed]')).map((b) => b.textContent)).toEqual(['pricing2', 'table1', 'toggle1']);
    await click(panel.querySelector('button[aria-pressed]')!);
    expect(names(box)).toEqual(['Annual toggle', 'Three tiers']);
    await click(panel.querySelector('.clear')!);
    expect(names(box).length).toBe(4);
  });

  it('shows archived prototypes only behind the Archived chip', async () => {
    const box = await lib();
    const chip = Array.from(box.querySelectorAll('.chip-toggle')).find((b) => b.textContent === 'Archived')!;
    await click(chip);
    expect(names(box)).toEqual(['Old idea']);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches to a list with a row per prototype, and remembers it', async () => {
    const box = await lib();
    await click(viewButton(box, 'List'));
    expect(box.querySelectorAll('.prow').length).toBe(4);
    expect(viewButton(box, 'List').getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('canon-project-view')).toBe('list');
  });

  it('stars a prototype for all of its versions and the button reflects it', async () => {
    const box = await lib();
    const star = box.querySelector<HTMLButtonElement>('[data-card="e2"] .st')!;
    expect(nameOf(star)).toBe('Star Checkout v2');
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await click(star);
    await new Promise((r) => setTimeout(r, 0));
    const stored = db.writes.filter(([n, v]) => n === 'frames' && v.starred === true).map(([, v]) => v.id).sort();
    expect(stored).toEqual(['e1', 'e2']);
    expect(box.querySelector('[data-card="e2"] .st')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('expands a prototype with versions in the list', async () => {
    const box = await lib();
    await click(viewButton(box, 'List'));
    const btn = box.querySelector<HTMLButtonElement>('.ver-btn')!;
    expect(nameOf(btn)).toBe('2 versions of Checkout v2');
    await click(btn);
    expect(box.querySelectorAll('.prow').length).toBe(5);
    expect(box.querySelector('.prow.older .link')!.textContent).toBe('Make current');
  });

  it('has a name and a real label on every control, in the grid and in the list', async () => {
    const box = await lib();
    expect(unnamed(box)).toEqual([]);
    await click(viewButton(box, 'List'));
    expect(unnamed(box)).toEqual([]);
    expect(box.querySelectorAll('input[type="checkbox"]').length).toBe(4);
  });
});
