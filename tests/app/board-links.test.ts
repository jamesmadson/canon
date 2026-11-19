// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => structuredClone(db.lists[name] ?? []),
  put: async () => {},
  putMany: async () => {},
  remove: async () => {},
  replaceFiles: async () => {},
}));

import * as store from '../../src/app/store';
import { App } from '../../src/app/ui';
import { buildAddress, parseAddress } from '../../src/app/lib/address';
import { resetLive } from '../../src/app/live';
import { openHash } from '../../src/app/lib/nav';
import { clear, click, frame, mount, nameOf, project } from './helpers/dom';

const board = (id: string, projectId: string, name: string, updatedAt = 1) => ({ id, projectId, name, createdAt: 1, updatedAt, arrangement: 'free' as const });
const spot = (id: string, boardId: string, frameId: string, x = 0, y = 0) => ({ id, boardId, frameId, x, y });

beforeEach(async () => {
  resetLive();
  localStorage.clear();
  db.lists = {
    projects: [project('one', 'Alpha', 3), project('many', 'Beta', 2), project('none', 'Gamma', 1)],
    boards: [board('a1', 'one', 'Flows'), board('m1', 'many', 'Round one', 5), board('m2', 'many', 'Round two', 4)],
    frames: [
      frame({ id: 'fa', projectId: 'one', name: 'Annual toggle', kind: 'url', url: 'https://x.test/a', w: 400, h: 300, createdAt: 3 }),
      frame({ id: 'fb', projectId: 'many', name: 'Three tiers', kind: 'url', url: 'https://x.test/b', w: 400, h: 300, createdAt: 2 }),
      frame({ id: 'fc', projectId: 'many', name: 'Plan picker', kind: 'url', url: 'https://x.test/c', w: 400, h: 300, createdAt: 1 }),
      frame({ id: 'fd', projectId: 'none', name: 'Loose idea', kind: 'url', url: 'https://x.test/d', w: 400, h: 300, createdAt: 1 }),
    ],
    placements: [spot('s1', 'a1', 'fa'), spot('s2', 'm1', 'fb'), spot('s3', 'm2', 'fb', 900, 0), spot('s4', 'm1', 'fc', 500, 0)],
    notes: [],
  };
  await store.load();
  store.dismissToast();
  history.replaceState(null, '', '#/');
});
afterEach(clear);

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const go = async (hash: string) => { await act(() => { location.hash = hash; }); await settle(); };
const back = async () => { await act(() => { history.back(); }); await vi.waitFor(() => expect(location.hash).not.toBe('')); await settle(); };
const group = (box: HTMLElement, name: string) => box.querySelector<HTMLElement>(`[data-project][aria-label="${name}"]`)!;

describe('Open board on Home', () => {
  it('is a quiet link on a project with one board, nothing on a project with none, in the list', async () => {
    const box = await mount(App, {});
    await settle();
    const link = group(box, 'Alpha').querySelector<HTMLAnchorElement>('a.quiet-link')!;
    expect(link.textContent).toContain('Open board');
    expect(link.getAttribute('href')).toBe('#/b/a1');
    expect(link.classList.contains('btn')).toBe(false);
    expect(group(box, 'Gamma').querySelector('.quiet-link')).toBeNull();
  });

  it('is a Boards menu of links for a project with several', async () => {
    const box = await mount(App, {});
    await settle();
    const menu = group(box, 'Beta').querySelector<HTMLButtonElement>('button.quiet-link')!;
    expect(nameOf(menu)).toBe('Boards of Beta');
    expect(menu.getAttribute('aria-expanded')).toBe('false');
    await click(menu);
    const items = Array.from(box.querySelectorAll<HTMLAnchorElement>('[role="menu"] [role="menuitem"]'));
    expect(items.map((i) => i.textContent)).toEqual(['Round one', 'Round two']);
    expect(items[1].getAttribute('href')).toBe('#/b/m2');
  });

  it('opens the board canvas, and Back returns to Home', async () => {
    const box = await mount(App, {});
    await settle();
    await click(group(box, 'Alpha').querySelector('a.quiet-link')!);
    expect(location.hash).toBe('#/b/a1');
    expect(box.querySelector('.canvas')).toBeTruthy();
    await act(() => { history.back(); });
    await vi.waitFor(() => expect(location.hash).toMatch(/^(#\/)?$/));
    await settle();
    expect(box.querySelector('.canvas')).toBeNull();
    expect(box.querySelector('[data-project]')).toBeTruthy();
  });

  it('shows on the shelf too, beside Open project', async () => {
    localStorage.setItem('canon-home-view', 'shelf');
    const box = await mount(App, {});
    await settle();
    const head = box.querySelector<HTMLElement>('.srow[aria-label="Alpha"] .shead')!;
    expect(Array.from(head.querySelectorAll('a')).map((a) => a.textContent?.trim())).toEqual(['Open board Alpha', 'Open project Alpha']);
    expect(box.querySelector('.srow[aria-label="Gamma"] .quiet-link')).toBeNull();
    expect(box.querySelector('.srow[aria-label="Beta"] button.quiet-link')).toBeTruthy();
  });

  it('leaves the Boards tab in the project view', async () => {
    const box = await mount(App, {});
    await go('#/p/one');
    expect(Array.from(box.querySelectorAll('.tabs a')).map((a) => a.textContent)).toContain('Boards 1');
  });
});

describe('Show on board in the prototype view', () => {
  const open = async (id: string) => {
    const box = await mount(App, {});
    await go(buildAddress({ name: 'full', frame: id, board: null, width: null, path: null }));
    return box;
  };

  it('is a quiet link by Open in new tab when the prototype is on one board', async () => {
    const box = await open('fa');
    const link = box.querySelector<HTMLAnchorElement>('.topbar a.quiet-link')!;
    expect(link.textContent).toContain('Show on board');
    expect(parseAddress(link.getAttribute('href')!)).toEqual({ name: 'board', board: 'a1', frame: null, show: 'fa' });
    const order = Array.from(box.querySelectorAll('.topbar .quiet-link, .topbar [aria-label="Open in new tab"]'));
    expect(order[0]).toBe(link);
  });

  it('is a menu of boards when it is on several, and nothing when it is on none', async () => {
    const box = await open('fb');
    const menu = box.querySelector<HTMLButtonElement>('.topbar button.quiet-link')!;
    await click(menu);
    expect(Array.from(box.querySelectorAll('.topbar [role="menuitem"]')).map((i) => i.textContent)).toEqual(['Round one', 'Round two']);
    clear();
    const none = await open('fd');
    expect(none.querySelector('.topbar .quiet-link')).toBeNull();
  });

  it('opens the board centred on the prototype with it selected, and Back returns to the prototype', async () => {
    const box = await open('fc');
    await click(box.querySelector('.topbar a.quiet-link')!);
    await settle();
    expect(location.hash).toBe('#/b/m1?show=fc');
    const selected = box.querySelectorAll('.canvas .frame.selected');
    expect(selected).toHaveLength(1);
    expect((selected[0] as HTMLElement).dataset.frame).toBe('fc');
    await act(() => { history.back(); });
    await vi.waitFor(() => expect(location.hash).toBe('#/f/fc/full'));
    await settle();
    expect(box.querySelector('.canvas')).toBeNull();
    expect(box.querySelector('.focus')).toBeTruthy();
  });

  it('is left out once the prototype is open from its board', async () => {
    const box = await mount(App, {});
    await act(() => { openHash('#/b/a1/f/fa/full'); });
    await settle();
    expect(box.querySelector('.topbar .quiet-link')).toBeNull();
  });
});

describe('the board address', () => {
  it('round-trips show, and a plain board link has none', () => {
    expect(buildAddress({ name: 'board', board: 'b', frame: null, show: 'f 1' })).toBe('#/b/b?show=f%201');
    expect(parseAddress('#/b/b?show=f%201')).toEqual({ name: 'board', board: 'b', frame: null, show: 'f 1' });
    expect(parseAddress('#/b/b')).toEqual({ name: 'board', board: 'b', frame: null });
  });
});
