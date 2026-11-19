// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { act } from 'preact/test-utils';
import { useEffect, useState } from 'preact/hooks';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async () => {},
}));

import * as store from '../../src/app/store';
import { PrototypeView, openPrototype } from '../../src/app/prototype';
import { parseAddress } from '../../src/app/lib/address';
import { resetViews, defaultView, pagesLabel } from '../../src/app/lib/pageview';
import { cardOf } from '../../src/app/lib/home';
import { ProtoRow, ShelfCard } from '../../src/app/parts';
import { resetLive } from '../../src/app/live';
import { clear, click, frame, mount, nameOf, project } from './helpers/dom';

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

const pagesOfN = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 'index.html' : `p${i}.html`));
const btn = (box: HTMLElement, label: RegExp) => Array.from(box.querySelectorAll<HTMLButtonElement>('button')).find((b) => label.test(nameOf(b)));
const view = (box: HTMLElement) => box.querySelector<HTMLElement>('[role="group"][aria-label="View"]');
const pressed = (box: HTMLElement) => Array.from(view(box)!.querySelectorAll('button')).find((b) => b.getAttribute('aria-pressed') === 'true')!.textContent;

beforeEach(async () => {
  resetLive();
  resetViews();
  db.lists = {
    projects: [project('p1', 'Site')], boards: [], placements: [], notes: [],
    frames: [
      frame({ id: 'four', name: 'Four pages', pages: pagesOfN(4), links: [['index.html', 'p1.html'], ['p1.html', 'p2.html']], createdAt: 1, updatedAt: 1 }),
      frame({ id: 'two', name: 'Two pages', pages: pagesOfN(2), createdAt: 2, updatedAt: 2 }),
      frame({ id: 'one', name: 'One page', createdAt: 3, updatedAt: 3 }),
      frame({ id: 'link', name: 'A link', kind: 'url', url: 'https://example.org/', entry: undefined, pages: pagesOfN(3), createdAt: 4, updatedAt: 4 }),
    ],
  };
  await store.load();
  history.replaceState(null, '', '#/');
});
afterEach(() => { clear(); });

const open = async (id: string) => {
  const box = await mount(Router, {});
  await act(() => { openPrototype({ id }); });
  return box;
};

describe('the map tool palette', () => {
  it('sits at the top left of the stage, 12px in, not at the top centre', () => {
    const css = readFileSync('src/app/app.css', 'utf8');
    const rule = /^\.map-tools \{([^}]*)\}/m.exec(css)![1];
    expect(rule).toMatch(/top: 12px/);
    expect(rule).toMatch(/left: 12px/);
    expect(rule).toMatch(/transform: none/);
  });
});

describe('the Page and Map control', () => {
  it('appears only for a prototype with more than one page', async () => {
    expect(view(await open('four'))).toBeTruthy();
    clear(); history.replaceState(null, '', '#/');
    expect(view(await open('two'))).toBeTruthy();
    clear(); history.replaceState(null, '', '#/');
    expect(view(await open('one'))).toBeNull();
    clear(); history.replaceState(null, '', '#/');
    expect(view(await open('link'))).toBeNull();
  });

  it('is placed before the device sizes, as real buttons that say which is chosen', async () => {
    const box = await open('four');
    const groups = Array.from(box.querySelectorAll('.topbar [role="group"]')).map((g) => g.getAttribute('aria-label'));
    expect(groups.indexOf('View')).toBeLessThan(groups.indexOf('Width') < 0 ? 99 : groups.indexOf('Width'));
    expect(Array.from(view(box)!.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['Page', 'Map']);
  });

  it('opens on the map from three pages, and on the page for two', async () => {
    expect(defaultView(3)).toBe('map');
    expect(defaultView(2)).toBe('page');
    expect(pressed(await open('four'))).toBe('Map');
    expect(document.querySelector('.map-board')).toBeTruthy();
    clear(); history.replaceState(null, '', '#/');
    expect(pressed(await open('two'))).toBe('Page');
    expect(document.querySelector('.map-board')).toBeNull();
  });

  it('keeps the whole bottom bar and the top bar when switching', async () => {
    const box = await open('four');
    const bars = () => [/^Star, /, /^Note, /, /^Versions/, /^Archive, /, /^Zoom \d+%/, /^Zoom out/, /^Zoom in/, /^Fit everything/].map((l) => !!btn(box, l));
    expect(bars()).toEqual(Array(8).fill(true));
    expect(box.querySelector('.viewer-bar')).toBeTruthy();
    await click(btn(box, /^Page$/)!);
    expect(pressed(box)).toBe('Page');
    expect(bars()).toEqual(Array(8).fill(true));
    expect(btn(box, /^Back/)).toBeTruthy();
    await click(btn(box, /^Map$/)!);
    expect(bars()).toEqual(Array(8).fill(true));
    expect(box.querySelector('.map-board')).toBeTruthy();
  });

  it('remembers the choice for the session, per prototype', async () => {
    let box = await open('four');
    await click(btn(box, /^Page$/)!);
    clear(); history.replaceState(null, '', '#/');
    box = await open('four');
    expect(pressed(box)).toBe('Page');
    clear(); history.replaceState(null, '', '#/');
    box = await open('two');
    await click(btn(box, /^Map$/)!);
    clear(); history.replaceState(null, '', '#/');
    expect(pressed(await open('two'))).toBe('Map');
  });

  it('opens a page chosen in the map on the page view, and Back returns to the map', async () => {
    const box = await open('four');
    // jsdom has no pointer events, so Preact listens under the name as written.
    const inMap = document.querySelector<HTMLElement>('[data-page="p1.html"]')!;
    await act(() => { inMap.dispatchEvent(new MouseEvent('PointerDown', { bubbles: true, button: 0 })); });
    await click(btn(box, /^Open$/)!);
    expect(pressed(box)).toBe('Page');
    expect(box.querySelector('iframe')!.getAttribute('src')).toContain('p1.html');
    await click(btn(box, /^Back$/)!);
    expect(pressed(box)).toBe('Map');
    expect(location.hash).toContain('/full');
  });
});

describe('the pages count in lists', () => {
  const card = (id: string) => cardOf(store.getState().frames.find((f) => f.id === id)!);
  it('labels only prototypes that have a map', () => {
    expect(pagesLabel(card('four').frame)).toBe('4 pages');
    expect(pagesLabel(card('one').frame)).toBe('');
    expect(pagesLabel(card('link').frame)).toBe('');
    expect(card('link').pages).toBe(1);
  });

  it('shows in the list row and the shelf card, and not for a single page', async () => {
    const row = await mount(() => h('ul', null, h(ProtoRow, { card: card('four'), onOpen: () => {} }), h(ProtoRow, { card: card('one'), onOpen: () => {} })), {});
    const rows = row.querySelectorAll('.prow');
    expect(rows[0].querySelector('.ver')!.textContent).toBe('4 pages');
    expect(rows[1].querySelector('.ver')!.textContent).toBe('');
    clear();
    const shelf = await mount(() => h('ul', null, h(ShelfCard, { card: card('four'), onOpen: () => {} }), h(ShelfCard, { card: card('one'), onOpen: () => {} })), {});
    const cards = shelf.querySelectorAll('.scard');
    expect(cards[0].textContent).toContain('4 pages');
    expect(cards[1].textContent).not.toContain('pages');
  });

  it('joins with versions when both apply', () => {
    const c = { ...card('four'), versions: 3 };
    return mount(() => h('ul', null, h(ProtoRow, { card: c, onOpen: () => {} })), {}).then((box) => {
      expect(box.querySelector('.ver')!.textContent).toBe('4 pages · 3 versions');
    });
  });
});
