// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';
import type { ComponentType } from 'preact';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { App } from '../../src/app/ui';
import { HomeBody, type HomeBodyProps } from '../../src/app/home';
import { TagBar } from '../../src/app/tagbar';
import { buildAddress, canonicalAddress, parseAddress } from '../../src/app/lib/address';
import { CANDIDATES, layoutChips, matchTags, toggleTag } from '../../src/app/lib/tagbar';
import { cardsOf, scopeCards, tagCounts } from '../../src/app/lib/home';
import { clear, click, fifty, frame, mount, nameOf, project, type } from './helpers/dom';

afterEach(() => { clear(); vi.restoreAllMocks(); });

/** jsdom does no layout, so say how wide things are: the row 500px, every chip 80px. */
function layoutOf(rowWidth: number, chipWidth = 80) {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(chipWidth);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.classList.contains('tagbar-row') ? rowWidth : 0; });
}

const tagList = (n: number) => Array.from({ length: n }, (_, i) => ({ tag: `Tag ${String(i + 1).padStart(2, '0')}`, count: n - i }));
const chips = (box: HTMLElement) => Array.from(box.querySelectorAll('.tagbar-row .fchip')).map((c) => c.textContent);
const pressed = (box: HTMLElement) => Array.from(box.querySelectorAll('.tagbar-row > .fchip[aria-pressed="true"]')).map((c) => c.textContent);
const chip = (box: HTMLElement, text: string) => Array.from(box.querySelectorAll<HTMLButtonElement>('.tagbar-row > .fchip')).find((c) => c.textContent === text)!;

describe('what fits in the row', () => {
  const c = (tag: string, width = 80, chosen = false) => ({ tag, width, chosen });

  it('keeps every tag when they all fit, and shows no More', () => {
    expect(layoutChips([c('a'), c('b')], 400, 50, 80, 8)).toEqual({ visible: ['a', 'b'], overflow: false });
  });

  it('keeps the most used that fit after All and More, in rank order', () => {
    const r = layoutChips(['a', 'b', 'c', 'd', 'e', 'f'].map((t) => c(t)), 420, 50, 80, 8);
    expect(r.overflow).toBe(true);
    expect(r.visible).toEqual(['a', 'b', 'c']);
  });

  it('always keeps a chosen tag, even one that would not fit', () => {
    const r = layoutChips([c('a'), c('b'), c('z', 80, true)], 260, 50, 80, 8);
    expect(r.visible).toContain('z');
    expect(r.overflow).toBe(true);
  });

  it('toggles a tag on and off without regard to case, and keeps the order chosen', () => {
    expect(toggleTag([], 'Pricing')).toEqual(['Pricing']);
    expect(toggleTag(['Pricing'], 'Billing')).toEqual(['Pricing', 'Billing']);
    expect(toggleTag(['Pricing', 'Billing'], 'pricing')).toEqual(['Billing']);
  });

  it('finds tags by what was typed', () => {
    expect(matchTags([{ tag: 'Annual toggle' }, { tag: 'Billing' }], 'tog')).toEqual([{ tag: 'Annual toggle' }]);
    expect(matchTags([{ tag: 'Billing' }], '  ')).toHaveLength(1);
  });
});

describe('the chip row', () => {
  it('starts with All chosen, then the most used tags, as many as fit', async () => {
    layoutOf(500);
    const box = await mount(TagBar, { tags: tagList(10), chosen: [] as string[], onChange: () => {} });
    expect(chips(box)).toEqual(['All', 'Tag 01', 'Tag 02', 'Tag 03', 'More']);
    expect(pressed(box)).toEqual(['All']);
  });

  it('chooses a single tag, and All clears it', async () => {
    layoutOf(900);
    const onChange = vi.fn();
    const box = await mount(TagBar, { tags: tagList(4), chosen: [] as string[], onChange });
    await click(chip(box, 'Tag 02'));
    expect(onChange).toHaveBeenLastCalledWith(['Tag 02']);
    await act(() => { box.innerHTML = ''; });
    const again = await mount(TagBar, { tags: tagList(4), chosen: ['Tag 02'], onChange });
    expect(pressed(again)).toEqual(['Tag 02']);
    await click(chip(again, 'All'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('chooses more than one, and takes one off again', async () => {
    layoutOf(900);
    const onChange = vi.fn();
    const box = await mount(TagBar, { tags: tagList(4), chosen: ['Tag 01'], onChange });
    await click(chip(box, 'Tag 03'));
    expect(onChange).toHaveBeenLastCalledWith(['Tag 01', 'Tag 03']);
    await click(chip(box, 'Tag 01'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('marks the chosen ones by fill and weight, not by orange', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/app/app.css', 'utf8');
    const rule = /\.fchip\[aria-pressed="true"\] \{([^}]*)\}/.exec(css)![1];
    expect(rule).toMatch(/background: var\(--raised\)/);
    expect(rule).toMatch(/font-weight: 500/);
    expect(rule).not.toMatch(/accent|FF4F00/i);
    expect(css).toMatch(/\.fchip \{[^}]*height: var\(--h-chip\)[^}]*border-radius: var\(--r-md\)/);
  });

  it('opens the full list from More, with every tag and its count', async () => {
    layoutOf(500);
    const onChange = vi.fn();
    const box = await mount(TagBar, { tags: tagList(12), chosen: [] as string[], onChange });
    const more = box.querySelector<HTMLButtonElement>('.fchip.more')!;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await click(more);
    const menu = box.querySelector('#tag-menu')!;
    expect(menu.querySelectorAll('.tag-list button')).toHaveLength(12);
    expect(menu.querySelector('input')).toBeNull();
    await click(menu.querySelectorAll<HTMLButtonElement>('.tag-list button')[5]);
    expect(onChange).toHaveBeenLastCalledWith(['Tag 06']);
  });

  it('gives the menu a search field when there are more than 20 tags', async () => {
    layoutOf(500);
    const box = await mount(TagBar, { tags: tagList(24), chosen: [] as string[], onChange: () => {} });
    await click(box.querySelector('.fchip.more')!);
    const input = box.querySelector<HTMLInputElement>('#tag-menu input')!;
    expect(nameOf(input)).toBe('Search tags');
    expect(document.activeElement).toBe(input);
    await type(input, 'tag 2');
    const shown = Array.from(box.querySelectorAll('#tag-menu .tag-list button span')).map((s) => s.textContent);
    expect(shown).toEqual(['Tag 20', 'Tag 21', 'Tag 22', 'Tag 23', 'Tag 24']);
    expect(CANDIDATES).toBeGreaterThanOrEqual(20);
  });

  it('closes the menu with Escape and puts focus back on More', async () => {
    layoutOf(500);
    const box = await mount(TagBar, { tags: tagList(12), chosen: [] as string[], onChange: () => {} });
    const more = box.querySelector<HTMLButtonElement>('.fchip.more')!;
    await click(more);
    await act(() => { box.querySelector('#tag-menu')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(box.querySelector('#tag-menu')).toBeNull();
    expect(document.activeElement).toBe(more);
  });

  it('keeps a chosen tag in the row even when it is not among the most used', async () => {
    layoutOf(500);
    const box = await mount(TagBar, { tags: tagList(12), chosen: ['Tag 11'], onChange: () => {} });
    expect(chips(box)).toContain('Tag 11');
    expect(pressed(box)).toEqual(['Tag 11']);
  });
});

describe('the filter on Home', () => {
  const home = (over: Partial<HomeBodyProps> = {}): HomeBodyProps => {
    const { frames, projects } = fifty();
    const cards = scopeCards(cardsOf(frames), { kind: 'home' });
    return { scope: { kind: 'home' }, cards, projects, view: 'list', onView: () => {}, chosenTags: [], onTags: () => {}, tagList: tagCounts(cards), onOpen: () => {}, onWay: () => {}, arriving: null, landed: null, ...over };
  };

  it('puts the chip row under the header, above the list', async () => {
    const box = await mount(HomeBody, home());
    const kids = Array.from(box.querySelector('main')!.children).map((e) => e.className.split(' ')[0]);
    expect(kids.slice(0, 3)).toEqual(['bar', 'tagbar', 'body']);
  });

  it('says so when no prototype has all the chosen tags, with a way back', async () => {
    const onTags = vi.fn();
    const box = await mount(HomeBody, home({ cards: [], chosenTags: ['Pricing', 'Search'], onTags }));
    expect(box.querySelector('.empty p')!.textContent).toBe('No prototypes have all of these tags.');
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Clear filters')!);
    expect(onTags).toHaveBeenCalledWith([]);
  });

  it('has no Filter menu in the header any more', async () => {
    const box = await mount(HomeBody, home());
    expect(Array.from(box.querySelectorAll('header button')).some((b) => b.textContent?.startsWith('Filter'))).toBe(false);
  });
});

describe('the filter in the address', () => {
  it('writes the chosen tags as repeated tag parameters and reads them back', () => {
    const a = { name: 'home' as const, tags: ['Pricing', 'Annual toggle'] };
    expect(buildAddress(a)).toBe('#/?tag=Pricing&tag=Annual%20toggle');
    expect(parseAddress(buildAddress(a))).toEqual(a);
    for (const name of ['starred', 'archive'] as const) expect(parseAddress(buildAddress({ name, tags: ['a/b'] }))).toEqual({ name, tags: ['a/b'] });
  });

  it('leaves the plain addresses as they were', () => {
    expect(buildAddress({ name: 'home' })).toBe('#/');
    expect(parseAddress('#/')).toEqual({ name: 'home' });
    expect(parseAddress('#/?tag=')).toEqual({ name: 'home' });
    expect(parseAddress('#/starred')).toEqual({ name: 'starred' });
  });

  it('sends an older tag link to the same filter', () => {
    expect(canonicalAddress({ name: 'tag', tag: 'pricing' }, false)).toEqual({ name: 'home', tags: ['pricing'] });
  });
});

describe('the filter through the app', () => {
  beforeEach(async () => {
    layoutOf(900);
    db.writes = [];
    const tagged = (id: string, tags: string[]) => frame({ id, name: `Proto ${id}`, tags, createdAt: 1, updatedAt: 1 });
    db.lists = {
      projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [],
      frames: [tagged('a', ['Pricing', 'Billing']), tagged('b', ['Pricing']), tagged('c', ['Billing']), tagged('d', ['Forms'])],
    };
    await store.load();
    history.replaceState(null, '', '#/');
  });
  const names = () => Array.from(document.querySelectorAll('.prow .nm')).map((n) => n.textContent);
  const settle = () => act(() => new Promise<void>((r) => setTimeout(r, 20)));

  it('filters by one tag, then by two, and keeps the choice in the address', async () => {
    const box = await mount(App as ComponentType, {});
    expect(names()).toHaveLength(4);
    await click(chip(box, 'Pricing'));
    expect(location.hash).toBe('#/?tag=Pricing');
    expect(names().sort()).toEqual(['Proto a', 'Proto b']);
    await click(chip(box, 'Billing'));
    expect(location.hash).toBe('#/?tag=Pricing&tag=Billing');
    expect(names()).toEqual(['Proto a']);
    expect(pressed(box).sort()).toEqual(['Billing', 'Pricing']);
  });

  it('opens already filtered from a shared link, and Back undoes the last choice', async () => {
    history.replaceState(null, '', '#/?tag=Forms');
    const box = await mount(App as ComponentType, {});
    expect(names()).toEqual(['Proto d']);
    expect(pressed(box)).toEqual(['Forms']);
    await click(chip(box, 'Billing'));
    expect(names()).toEqual([]);
    expect(box.querySelector('.empty p')!.textContent).toBe('No prototypes have all of these tags.');
    await act(() => { history.back(); });
    await settle();
    expect(location.hash).toBe('#/?tag=Forms');
    expect(names()).toEqual(['Proto d']);
  });

  it('clears everything from the empty state', async () => {
    history.replaceState(null, '', '#/?tag=Forms&tag=Billing');
    const box = await mount(App as ComponentType, {});
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Clear filters')!);
    expect(location.hash).toBe('#/');
    expect(names()).toHaveLength(4);
  });

  it('sends a sidebar tag to the same filter', async () => {
    const box = await mount(App as ComponentType, {});
    const link = Array.from(box.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Tags"] a')).find((a) => a.textContent?.startsWith('Billing'))!;
    expect(link.getAttribute('href')).toBe('#/?tag=Billing');
  });
});
