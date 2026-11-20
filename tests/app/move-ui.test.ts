// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'preact';
import { act } from 'preact/test-utils';
import { useEffect, useState } from 'preact/hooks';

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
const table = (n: string) => (db.tables[n] ??= []);
const upsert = (n: string, v: any) => {
  const t = table(n);
  const i = t.findIndex((x) => x.id === v.id);
  if (i >= 0) t[i] = structuredClone(v); else t.push(structuredClone(v));
};
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(table(n)),
  put: async (n: string, v: any) => upsert(n, v),
  putMany: async (n: string, vs: any[]) => vs.forEach((v) => upsert(n, v)),
  remove: async (n: string, id: string) => { db.tables[n] = table(n).filter((x) => x.id !== id); },
  replaceFiles: async () => {},
}));

import * as store from '../../src/app/store';
import { PrototypeView, openPrototype } from '../../src/app/prototype';
import { Sidebar } from '../../src/app/sidebar';
import { Library } from '../../src/app/ui';
import { parseAddress } from '../../src/app/lib/address';
import { resetLive } from '../../src/app/live';
import { DRAG_TYPE } from '../../src/app/move';
import { clear, click, fire, frame, mount, nameOf, project, type as typeInto } from './helpers/dom';

const Router = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const a = parseAddress(hash);
  return a.name === 'full' ? h(PrototypeView, { address: a }) : h('div', { id: 'elsewhere' }, hash);
};

beforeEach(async () => {
  resetLive();
  db.tables = {
    projects: [project('p1', 'Pricing', 3), project('p2', 'Checkout', 2), project('p3', 'Search', 1)],
    boards: [{ id: 'b2', projectId: 'p2', name: 'Flows', createdAt: 1, updatedAt: 1, arrangement: 'free' }],
    placements: [],
    notes: [],
    frames: [
      frame({ id: 'a', name: 'Annual toggle', projectId: 'p1', kind: 'url', url: 'https://x.test/a', createdAt: 1 }),
      frame({ id: 'b', name: 'Three tiers', projectId: 'p1', kind: 'url', url: 'https://x.test/b', createdAt: 2 }),
    ],
  };
  await store.load();
  store.dismissToast();
  localStorage.clear();
  history.replaceState(null, '', '#/');
});
afterEach(clear);

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const by = (root: ParentNode, sel: string, text: RegExp) => Array.from(root.querySelectorAll<HTMLElement>(sel)).find((e) => text.test(e.textContent ?? ''))!;
const projectOf = (id: string) => store.getState().frames.find((f) => f.id === id)!.projectId;

describe('Move in the prototype view', () => {
  const open = async () => {
    const box = await mount(Router, {});
    await act(() => { openPrototype({ id: 'a' }); });
    return box;
  };

  it('is a labelled button after Archive in the action group', async () => {
    const box = await open();
    const acts = box.querySelector('.vb-acts')!;
    const names = Array.from(acts.querySelectorAll('button')).map((b) => nameOf(b));
    expect(names.findIndex((n) => /^Archive,/.test(n))).toBeLessThan(names.findIndex((n) => /^Move /.test(n)));
    expect(box.querySelector('.vb-move .lbl')!.textContent).toBe('Move');
  });

  it('lists the projects with the current one marked and not selectable', async () => {
    const box = await open();
    await click(box.querySelector('.vb-move')!);
    const items = Array.from(box.querySelectorAll<HTMLButtonElement>('.move-list .move-item'));
    expect(items.map((i) => i.querySelector('span')!.textContent)).toEqual(['Pricing', 'Checkout', 'Search']);
    expect(items[0].disabled).toBe(true);
    expect(items[0].textContent).toContain('Current');
    expect(items[1].disabled).toBe(false);
  });

  it('searches the projects', async () => {
    const box = await open();
    await click(box.querySelector('.vb-move')!);
    await typeInto(box.querySelector<HTMLInputElement>('#move-search')!, 'sea');
    expect(Array.from(box.querySelectorAll('.move-list .move-item span')).map((s) => s.textContent)).toEqual(['Search']);
    await typeInto(box.querySelector<HTMLInputElement>('#move-search')!, 'zzz');
    expect(box.querySelector('.move-list')!.textContent).toContain('No project matches');
  });

  it('moves on choosing a project and offers Undo', async () => {
    const box = await open();
    await click(box.querySelector('.vb-move')!);
    await click(by(box, '.move-item', /Checkout/));
    await settle();
    expect(projectOf('a')).toBe('p2');
    expect(store.getState().toast).toBe('Moved to Checkout.');
    expect(store.getState().placements.map((p) => [p.boardId, p.frameId])).toEqual([['b2', 'a']]);
    expect(box.querySelector('.move-pop')).toBeNull();
    store.getState().toastAction!.run();
    await settle();
    expect(projectOf('a')).toBe('p1');
    expect(store.getState().placements).toEqual([]);
  });

  it('turns New project into a name field and moves into the project it makes', async () => {
    const box = await open();
    await click(box.querySelector('.vb-move')!);
    await click(by(box, '.move-new', /New project/));
    const input = box.querySelector<HTMLInputElement>('#move-new-name')!;
    expect(nameOf(input)).toBe('New project name');
    await typeInto(input, 'Onboarding');
    await fire(input.closest('form')!, new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    const made = store.getState().projects.find((p) => p.name === 'Onboarding')!;
    expect(projectOf('a')).toBe(made.id);
    expect(store.getState().toast).toBe('Moved to Onboarding.');
  });

  it('asks for a name when the field is empty and moves nothing', async () => {
    const box = await open();
    await click(box.querySelector('.vb-move')!);
    await click(by(box, '.move-new', /New project/));
    await fire(box.querySelector('#move-new-name')!.closest('form')!, new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(store.getState().toast).toBe('Give the new project a name.');
    expect(projectOf('a')).toBe('p1');
    expect(store.getState().projects).toHaveLength(3);
  });

  it('closes on Escape', async () => {
    const box = await open();
    await click(box.querySelector('.vb-move')!);
    await act(() => { box.querySelector('#move-search')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    expect(box.querySelector('.move-pop')).toBeNull();
  });
});

describe('Move to project in a row menu', () => {
  it('opens from a named button on each row and moves the prototype', async () => {
    const box = await mount(Library, { projectId: 'p1', askUrl: async () => null });
    await click(by(box, '.seg button', /List/));
    const more = box.querySelector<HTMLButtonElement>('.prow .more')!;
    expect(nameOf(more)).toMatch(/^More actions for /);
    await click(more);
    expect(Array.from(box.querySelectorAll('[role="menuitem"]')).map((i) => i.textContent)).toEqual(['Rename', 'Move to project']);
    const item = by(box, '[role="menuitem"]', /Move to project/);
    await click(item);
    await click(by(box, '.move-item', /Search/));
    await settle();
    const moved = store.getState().frames.filter((f) => f.projectId === 'p3');
    expect(moved).toHaveLength(1);
  });

  it('moves everything picked from the selection bar, as one step', async () => {
    const box = await mount(Library, { projectId: 'p1', askUrl: async () => null });
    for (const c of Array.from(box.querySelectorAll<HTMLInputElement>('.lib-check input'))) await click(c);
    await click(by(box, '.selection-bar button', /Move to project/));
    await click(by(box, '.move-item', /Checkout/));
    await settle();
    expect(store.getState().frames.every((f) => f.projectId === 'p2')).toBe(true);
    expect(store.getState().toast).toBe('Moved to Checkout.');
    store.getState().toastAction!.run();
    await settle();
    expect(store.getState().frames.every((f) => f.projectId === 'p1')).toBe(true);
  });
});

describe('dragging onto a project in the sidebar', () => {
  const drag = (type: string, data: string) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as any;
    e.dataTransfer = { types: [DRAG_TYPE], getData: () => data, setData: () => {}, dropEffect: 'none' };
    return e as Event;
  };

  it('lights the project, then moves the prototype and shows Undo', async () => {
    const box = await mount(Sidebar, { route: { name: 'home' } as any, activeProject: null });
    const link = box.querySelector<HTMLElement>('[data-drop-project="p2"]')!;
    const over = drag('dragover', JSON.stringify(['b']));
    await fire(link, over);
    expect(over.defaultPrevented).toBe(true);
    expect(link.classList.contains('drop')).toBe(true);
    await fire(link, drag('drop', JSON.stringify(['b'])));
    await settle();
    expect(link.classList.contains('drop')).toBe(false);
    expect(projectOf('b')).toBe('p2');
    expect(store.getState().toast).toBe('Moved to Checkout.');
  });

  it('ignores a drag that does not carry prototypes', async () => {
    const box = await mount(Sidebar, { route: { name: 'home' } as any, activeProject: null });
    const link = box.querySelector<HTMLElement>('[data-drop-project="p2"]')!;
    const e = drag('dragover', '[]') as any;
    e.dataTransfer.types = ['Files'];
    await fire(link, e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('says so when it is already there', async () => {
    const box = await mount(Sidebar, { route: { name: 'home' } as any, activeProject: null });
    await fire(box.querySelector('[data-drop-project="p1"]')!, drag('drop', JSON.stringify(['a'])));
    await settle();
    expect(store.getState().toast).toBe('Already in Pricing.');
  });
});
