// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';

const { setStarred } = vi.hoisted(() => ({ setStarred: vi.fn() }));
vi.mock('../../src/app/store', async (orig) => ({ ...(await orig<typeof import('../../src/app/store')>()), setStarred }));

import { FirstRun, Home, HomeBody, type HomeBodyProps } from '../../src/app/home';
import { cardsOf, scopeCards, tagCounts, type Card } from '../../src/app/lib/home';
import { SETUP_COMMAND } from '../../src/app/lib/setup';
import { SearchHost } from '../../src/app/palette';
import { clear, click, fifty, fire, frame, key, mount, nameOf, project, type, unnamed } from './helpers/dom';

afterEach(clear);

const props = (over: Partial<HomeBodyProps> = {}): HomeBodyProps => {
  const { frames, projects } = fifty();
  const cards = scopeCards(cardsOf(frames), { kind: 'home' });
  return {
    scope: { kind: 'home' }, cards, projects, view: 'list', onView: () => {}, chosenTags: [], onTags: () => {}, tagList: tagCounts(cards),
    onOpen: () => {}, onWay: () => {}, arriving: null, landed: null, ...over,
  };
};

describe('every control has a real label', () => {
  it('in the list view', async () => {
    const box = await mount(HomeBody, props());
    expect(box.querySelectorAll('button').length).toBeGreaterThan(50);
    expect(unnamed(box)).toEqual([]);
  });

  it('in the shelf view', async () => {
    const box = await mount(HomeBody, props({ view: 'shelf' }));
    expect(box.querySelectorAll('.scard').length).toBeGreaterThan(8);
    expect(unnamed(box)).toEqual([]);
  });

  it('in the Add menu and the filter panel when they are open', async () => {
    const box = await mount(HomeBody, props());
    await click(box.querySelector('button.add')!);
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Filter'))!);
    expect(box.querySelectorAll('[role="menuitem"]').length).toBe(4);
    expect(box.querySelector('#filter-panel')).toBeTruthy();
    expect(unnamed(box)).toEqual([]);
  });

  it('names each star after its prototype and reports whether it is on', async () => {
    const box = await mount(HomeBody, props());
    const star = box.querySelector<HTMLButtonElement>('[data-card="f0"] .st')!;
    expect(nameOf(star)).toBe('Star Pricing screen 0');
    expect(star.getAttribute('aria-pressed')).toBe('true');
    expect(box.querySelector('[data-card="f1"] .st')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('on the first run and in the search palette', async () => {
    const first = await mount(FirstRun, { onChoose: () => {} });
    expect(unnamed(first)).toEqual([]);
    const { frames, projects } = fifty();
    const host = await mount(SearchHost, { cards: cardsOf(frames), projectName: (id: string) => projects.find((p) => p.id === id)!.name, onPick: () => {} });
    await key(window, 'k', { metaKey: true });
    expect(unnamed(document.body)).toEqual([]);
    expect(document.querySelector('[role="combobox"]')).toBeTruthy();
    expect(host).toBeTruthy();
  });

  it('has real buttons and links only, never a clickable div', async () => {
    const box = await mount(HomeBody, props());
    expect(box.querySelectorAll('div[onclick], span[onclick], li[onclick]').length).toBe(0);
    for (const b of box.querySelectorAll('button')) expect(b.getAttribute('type')).toBe('button');
  });
});

describe('search is not capped without saying so', () => {
  it('searching a tag carried by 37 prototypes shows 12 of 37 and a way to show all', async () => {
    const frames = Array.from({ length: 37 }, (_, i) => frame({ id: `t${i}`, name: `Screen ${i}`, tags: ['claude-code'], createdAt: i, updatedAt: i }));
    await mount(SearchHost, { cards: cardsOf(frames), projectName: () => 'P', onPick: () => {} });
    await key(window, 'k', { metaKey: true });
    const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    await type(input, 'claude-code');
    expect(document.querySelectorAll('[role="option"]').length).toBe(12);
    expect(document.querySelector('.sw-more')!.textContent).toBe('Showing 12 of 37Show all');
    await click(document.querySelector('.sw-more button')!);
    expect(document.querySelectorAll('[role="option"]').length).toBe(37);
    expect(document.querySelector('.sw-more')).toBeNull();
  });

  it('shows no count when everything fits', async () => {
    const frames = Array.from({ length: 5 }, (_, i) => frame({ id: `t${i}`, name: `Screen ${i}`, tags: ['claude-code'] }));
    await mount(SearchHost, { cards: cardsOf(frames), projectName: () => 'P', onPick: () => {} });
    await key(window, 'k', { metaKey: true });
    await type(document.querySelector<HTMLInputElement>('input[role="combobox"]')!, 'claude-code');
    expect(document.querySelectorAll('[role="option"]').length).toBe(5);
    expect(document.querySelector('.sw-more')).toBeNull();
  });
});

describe('a named prototype is on screen in three actions or fewer', () => {
  const setup = async () => {
    const { frames, projects } = fifty();
    const opened: string[] = [];
    await mount(SearchHost, { cards: cardsOf(frames), projectName: (id: string) => projects.find((p) => p.id === id)!.name, onPick: (c: Card) => opened.push(c.name) });
    return opened;
  };

  it('is Command K, the name, then Enter', async () => {
    const opened = await setup();
    await key(window, 'k', { metaKey: true });                       // 1
    const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    expect(document.activeElement).toBe(input);
    await type(input, 'Dashboard screen 38');                        // 2
    await key(input, 'Enter');                                       // 3
    expect(opened).toEqual(['Dashboard screen 38']);
    expect(document.querySelector('.switcher')).toBeNull();
  });

  it('works with Control K and a partial name, using the arrow keys when the first hit is not the one', async () => {
    const opened = await setup();
    await key(window, 'k', { ctrlKey: true });
    const input = document.querySelector<HTMLInputElement>('input[role="combobox"]')!;
    await type(input, 'screen 4');
    const options = Array.from(document.querySelectorAll('[role="option"]')).map((o) => o.querySelector('b')!.textContent);
    expect(options.length).toBeGreaterThan(1);
    await key(input, 'ArrowDown');
    expect(document.querySelectorAll('[role="option"][aria-selected="true"]').length).toBe(1);
    expect(input.getAttribute('aria-activedescendant')).toBe('result-1');
    await key(input, 'Enter');
    expect(opened).toEqual([options[1]]);
  });

  it('closes on Escape without opening anything', async () => {
    const opened = await setup();
    await key(window, 'k', { metaKey: true });
    await key(document.querySelector('input')!, 'Escape');
    expect(document.querySelector('.switcher')).toBeNull();
    expect(opened).toEqual([]);
  });

  it('is one action from the list: pressing the prototype name', async () => {
    const opened: string[] = [];
    const box = await mount(HomeBody, props({ onOpen: (c: Card) => opened.push(c.name) }));
    await click(box.querySelector('[data-card="f12"] .nm')!);
    expect(opened).toEqual(['Onboarding screen 12']);
  });

  it('is one action from the shelf: pressing the card', async () => {
    const opened: string[] = [];
    const box = await mount(HomeBody, props({ view: 'shelf', onOpen: (c: Card) => opened.push(c.name) }));
    await click(box.querySelector('.scard .card-main')!);
    expect(opened).toHaveLength(1);
  });
});

describe('home paints quickly with 50 prototypes', () => {
  it('renders the list in well under a second', async () => {
    const p = props();
    const t0 = performance.now();
    const box = await mount(HomeBody, p);
    const ms = performance.now() - t0;
    expect(box.querySelectorAll('.prow').length).toBe(50);
    expect(ms).toBeLessThan(1000);
  });

  it('renders the shelf in well under a second', async () => {
    const t0 = performance.now();
    const box = await mount(HomeBody, props({ view: 'shelf' }));
    const ms = performance.now() - t0;
    expect(box.querySelectorAll('.scard').length).toBeGreaterThan(0);
    expect(ms).toBeLessThan(1000);
  });

  it('groups the cards without a pass over the whole list per project', () => {
    const { frames } = fifty();
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) cardsOf(frames);
    expect((performance.now() - t0) / 20).toBeLessThan(20);
  });
});

describe('first run', () => {
  it('shows the setup line and a drop target and nothing else', async () => {
    const box = await mount(Home, { scope: { kind: 'home' as const }, askUrl: async () => null, onOpen: () => {} });
    expect(box.textContent).toContain(SETUP_COMMAND);
    const controls = Array.from(box.querySelectorAll('button, a, input, select')).map((c) => nameOf(c));
    expect(controls).toEqual(['Copy', 'Drop a link or a zip here or choose files']);
    expect(box.querySelector('.bar')).toBeNull();
    expect(box.querySelector('.hint-bar')).toBeNull();
  });

  it('copies the setup line and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const box = await mount(FirstRun, { onChoose: () => {} });
    await click(box.querySelector('.setup button')!);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(writeText).toHaveBeenCalledWith('claude mcp add canon -- npx -y usecanon mcp');
    expect(box.querySelector('.setup button')!.textContent).toContain('Copied');
    expect(box.querySelector('[role="status"]')!.textContent).toContain('Copied');
  });

  it('opens the file chooser from the drop target', async () => {
    const chosen = vi.fn();
    const box = await mount(FirstRun, { onChoose: chosen });
    await click(box.querySelector('.first-drop')!);
    expect(chosen).toHaveBeenCalledOnce();
  });
});

describe('the list and the shelf', () => {
  it('lists the project with the latest prototype first, each prototype once, newest first', async () => {
    const box = await mount(HomeBody, props());
    const sections = Array.from(box.querySelectorAll('section.grp-wrap'));
    expect(sections[0].getAttribute('data-project')).toBe('p1'); // f49 is in p1
    const ids = Array.from(sections[0].querySelectorAll('.prow')).map((r) => r.getAttribute('data-card'));
    expect(ids[0]).toBe('f49');
  });

  it('puts the orange mark on one row only', async () => {
    const box = await mount(HomeBody, props());
    expect(box.querySelectorAll('.prow.sel').length).toBe(1);
  });

  it('moves with the arrow keys and Home and End', async () => {
    const box = await mount(HomeBody, props());
    const names = Array.from(box.querySelectorAll<HTMLElement>('.nm'));
    names[0].focus();
    await key(names[0], 'ArrowDown');
    expect(document.activeElement).toBe(names[1]);
    await key(names[1], 'End');
    expect(document.activeElement).toBe(names[names.length - 1]);
    await key(names[names.length - 1], 'Home');
    expect(document.activeElement).toBe(names[0]);
    expect(box.querySelectorAll('.prow.sel').length).toBe(1);
  });

  it('collapses a project row and says so', async () => {
    const box = await mount(HomeBody, props());
    const first = box.querySelector('section.grp-wrap')!;
    const before = first.querySelectorAll('.prow').length;
    expect(before).toBeGreaterThan(0);
    await click(first.querySelector('.gbtn')!);
    expect(first.querySelectorAll('.prow').length).toBe(0);
    expect(first.querySelector('.gbtn')!.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows at most five large cards per project in the shelf, with a link to the rest', async () => {
    const box = await mount(HomeBody, props({ view: 'shelf' }));
    for (const row of box.querySelectorAll('.srow')) {
      expect(row.querySelectorAll('.scard').length).toBeLessThanOrEqual(5);
      expect(row.querySelector('a')!.getAttribute('href')).toMatch(/^#\/p\//);
    }
    expect(box.querySelector('.srow .shead .muted')!.textContent).toMatch(/prototypes?$/);
  });

  it('shows a prototype with five versions as one item with a count, in the list and the shelf', async () => {
    const frames = [1, 2, 3, 4, 5].map((n) => frame({ id: `v${n}`, name: `Checkout v${n}`, stackId: 'v1', createdAt: n, updatedAt: n }));
    const cards = cardsOf(frames);
    for (const view of ['list', 'shelf'] as const) {
      const box = await mount(HomeBody, props({ cards, projects: [project('p1', 'One')], view }));
      expect(box.querySelectorAll('[data-card]').length).toBe(1);
      expect(box.querySelector('[data-card]')!.textContent).toContain('5 versions');
      clear();
    }
  });

  it('draws a neutral placeholder when a prototype has no preview', async () => {
    const cards = cardsOf([frame({ id: 'u', kind: 'url', url: 'https://example.com', name: 'A link' })]);
    const box = await mount(HomeBody, props({ cards, projects: [project('p1', 'One')], view: 'shelf' }));
    expect(box.querySelector('.scard .th .hd')).toBeTruthy();
    expect(box.querySelector('.scard iframe')).toBeNull();
  });

  it('shows the real page in list rows at the small size, and keeps the drawing only for a link with no preview', async () => {
    const cards = cardsOf([
      frame({ id: 'k', name: 'Kept here' }),
      frame({ id: 'u', kind: 'url', url: 'https://example.com', name: 'A link' }),
      frame({ id: 'c', kind: 'url', url: 'https://example.com/2', name: 'A cover', display: 'cover', cover: 'cover.png' }),
    ]);
    const box = await mount(HomeBody, props({ cards, projects: [project('p1', 'One')], view: 'list' }));
    const kept = box.querySelector('[data-card="k"] .th')!;
    expect(kept.classList.contains('live')).toBe(true);
    expect(kept.classList.contains('big')).toBe(false);
    expect(kept.querySelector('iframe')!.getAttribute('src')).toContain('/app/p/k/');
    expect(box.querySelector('[data-card="u"] .th .hd')).toBeTruthy();
    expect(box.querySelector('[data-card="c"] .th img')!.getAttribute('src')).toContain('/app/p/c/cover.png');
  });

  it('shows the stored cover for a link that has a screenshot', async () => {
    const cards = cardsOf([frame({ id: 'u', kind: 'url', url: 'https://example.com', name: 'A link', display: 'cover', cover: 'cover.png' })]);
    const box = await mount(HomeBody, props({ cards, projects: [project('p1', 'One')], view: 'shelf' }));
    expect(box.querySelector('.scard img')!.getAttribute('src')).toContain('/app/p/u/cover.png');
  });

  it('empty states say what to do', async () => {
    const box = await mount(HomeBody, props({ scope: { kind: 'starred' }, cards: [] }));
    expect(box.querySelector('.empty')!.textContent).toMatch(/Use the star/);
  });

  it('names the scope in the title', async () => {
    const box = await mount(HomeBody, props({ scope: { kind: 'tag', tag: 'pricing' } }));
    expect(box.querySelector('h1')!.textContent).toMatch(/^pricing/);
  });
});

describe('star', () => {
  it('toggles through the store', async () => {
    const box = await mount(HomeBody, props());
    await click(box.querySelector('[data-card="f1"] .st')!);
    expect(setStarred).toHaveBeenCalledWith('f1', true);
    await click(box.querySelector('[data-card="f0"] .st')!);
    expect(setStarred).toHaveBeenCalledWith('f0', false);
  });

  it('does not also open the prototype', async () => {
    const opened = vi.fn();
    const box = await mount(HomeBody, props({ onOpen: opened }));
    await click(box.querySelector('[data-card="f3"] .st')!);
    expect(opened).not.toHaveBeenCalled();
  });
});

describe('a dropped prototype arrives', () => {
  it('in the shelf, a zip lands in the first slot with its zipper and the others slide over', async () => {
    const p = props({ view: 'shelf', arriving: { stack: 'f49', zip: 'checkout-flow.zip' }, landed: 'f49' });
    const box = await mount(HomeBody, p);
    const row = box.querySelector('.srow[data-project="p1"]')!;
    const first = row.querySelector('.scard')!;
    expect(first.getAttribute('data-card')).toBe('f49');
    expect(first.classList.contains('arriving')).toBe(true);
    expect(first.classList.contains('zipped')).toBe(true);
    expect(first.querySelector('.zip .zname')!.textContent).toBe('checkout-flow.zip');
    expect(row.querySelector('.cards')!.classList.contains('arriving')).toBe(true);
    expect(first.querySelector('.tags')).toBeTruthy();
    expect(first.classList.contains('sel')).toBe(true);
  });

  it('a link or a folder fades in without a zipper', async () => {
    const box = await mount(HomeBody, props({ view: 'shelf', arriving: { stack: 'f49', zip: null }, landed: 'f49' }));
    const first = box.querySelector('.srow[data-project="p1"] .scard')!;
    expect(first.classList.contains('arriving')).toBe(true);
    expect(first.classList.contains('zipped')).toBe(false);
    expect(first.querySelector('.zip')).toBeNull();
  });

  it('in the list, the new row simply fades in', async () => {
    const box = await mount(HomeBody, props({ view: 'list', arriving: { stack: 'f49', zip: 'x.zip' }, landed: 'f49' }));
    const row = box.querySelector('[data-card="f49"]')!;
    expect(row.classList.contains('arriving')).toBe(true);
    expect(box.querySelector('.zip')).toBeNull();
  });

  it('settles into an ordinary card once the arrival is over', async () => {
    const box = await mount(HomeBody, props({ view: 'shelf', arriving: null, landed: 'f49' }));
    const first = box.querySelector('[data-card="f49"]')!;
    expect(first.classList.contains('arriving')).toBe(false);
    expect(first.querySelector('.zip')).toBeNull();
  });
});

describe('tags', () => {
  it('opens a filter that offers every tag with its count', async () => {
    const onTags = vi.fn();
    const box = await mount(HomeBody, props({ onTags }));
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Filter'))!);
    const first = box.querySelector<HTMLButtonElement>('#filter-panel button[aria-pressed]')!;
    await click(first);
    expect(onTags).toHaveBeenCalledWith([first.querySelector('span')!.textContent]);
  });
});

void fire;
