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

  const openFilter = async (box: HTMLElement) => {
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Filter'))!);
    return box.querySelector('#filter-panel')!;
  };
  const pill = (root: ParentNode, label: string) => Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.replace(/\d+$/, '') === label)!;

  it('keeps the toolbar to one Filter pill: the sources and quick filters live in its popover', async () => {
    const box = await lib();
    expect(box.querySelector('.lib-bar select[aria-label="Source"]')).toBeNull();
    expect(Array.from(box.querySelectorAll('.lib-bar .chip-toggle'))).toHaveLength(0);
    const panel = await openFilter(box);
    for (const label of ['All sources', 'Files', 'Linked folders', 'URLs', 'Multi-page', 'Open notes', 'Not on a board', 'Archived']) expect(pill(panel, label), label).toBeTruthy();
  });

  it('filters by tag, shows the tag as a chip that removes it, and clears the filter', async () => {
    const box = await lib();
    const panel = await openFilter(box);
    const tagPills = Array.from(panel.querySelectorAll('[aria-label="Tags"] button')).map((b) => b.textContent);
    expect(tagPills).toEqual(['pricing2', 'table1', 'toggle1']);
    await click(panel.querySelector('[aria-label="Tags"] button')!);
    expect(names(box)).toEqual(['Annual toggle', 'Three tiers']);
    const chip = box.querySelector<HTMLButtonElement>('.active-filters button')!;
    expect(chip.getAttribute('aria-label')).toBe('Remove filter: pricing');
    await click(chip);
    expect(names(box).length).toBe(4);
    expect(box.querySelector('.active-filters')).toBeNull();
    await click(panel.querySelector('[aria-label="Tags"] button')!);
    await click(pill(box.querySelector('#filter-panel')!, 'Clear filters'));
    expect(names(box).length).toBe(4);
  });

  it('filters by source and by a quick filter from the popover', async () => {
    const box = await lib();
    const panel = await openFilter(box);
    await click(pill(panel, 'URLs'));
    expect(names(box)).toEqual([]);
    expect(box.querySelector('.active-filters')!.textContent).toBe('URLs');
    await click(pill(panel, 'All sources'));
    await click(pill(panel, 'Open notes'));
    expect(names(box)).toEqual([]);
    await click(pill(panel, 'Open notes'));
    expect(names(box).length).toBe(4);
  });

  it('shows archived prototypes only behind the Archived filter', async () => {
    const box = await lib();
    const panel = await openFilter(box);
    const chip = pill(panel, 'Archived');
    await click(chip);
    expect(names(box)).toEqual(['Old idea']);
    expect(pill(box.querySelector('#filter-panel')!, 'Archived').getAttribute('aria-pressed')).toBe('true');
    expect(box.querySelector('.active-filters')!.textContent).toBe('Archived');
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

  it('shows a prototype with versions as one item with a count, in the grid and in the list', async () => {
    const box = await lib();
    expect(box.querySelectorAll('[data-card^="e"]').length).toBe(1);
    await click(viewButton(box, 'Grid'));
    expect(box.querySelector('[data-card="e2"] .lib-ver')!.textContent).toBe('2 versions');
    expect(box.querySelectorAll('[data-card^="e"]').length).toBe(1);
    await click(viewButton(box, 'List'));
    expect(box.querySelectorAll('.prow').length).toBe(4);
    expect(box.querySelector('[data-card="e2"] .ver')!.textContent).toBe('2 versions');
    expect(box.querySelector('.ver-btn')).toBeNull();
    expect(box.querySelector('.link')).toBeNull();
  });

  it('has a name and a real label on every control, in the grid and in the list', async () => {
    const box = await lib();
    expect(unnamed(box)).toEqual([]);
    await click(viewButton(box, 'List'));
    expect(unnamed(box)).toEqual([]);
    expect(box.querySelectorAll('input[type="checkbox"]').length).toBe(4);
  });
});
