// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'preact';
import { act } from 'preact/test-utils';
import { useEffect, useState } from 'preact/hooks';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { PrototypeView, openPrototype } from '../../src/app/prototype';
import { parseAddress } from '../../src/app/lib/address';
import { resetLive } from '../../src/app/live';
import { clear, click, frame, key, mount, nameOf, project } from './helpers/dom';

/** The route the app reads: whatever the hash says now. */
const askUrl = async () => 'https://new.example/';
const Router = () => {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  const a = parseAddress(hash);
  return a.name === 'full' ? h(PrototypeView, { address: a, askUrl }) : h('div', { id: 'elsewhere' }, hash);
};

const flush = () => new Promise((r) => setTimeout(r, 0));
const stored = (id: string) => db.writes.filter(([n, v]) => n === 'frames' && v.id === id).map(([, v]) => v);
const btn = (box: HTMLElement, label: RegExp) => Array.from(box.querySelectorAll<HTMLButtonElement>('button')).find((b) => label.test(nameOf(b)))!;
const title = (box: HTMLElement) => box.querySelector('h1')!.textContent;

beforeEach(async () => {
  resetLive();
  db.writes = [];
  db.lists = {
    projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [],
    frames: [
      frame({ id: 'a1', name: 'Annual toggle', stackId: 'a', createdAt: Date.now() - 3 * 86_400_000, updatedAt: 1 }),
      frame({ id: 'a2', name: 'Annual toggle', stackId: 'a', kind: 'url', url: 'https://example.com/a', entry: undefined, createdAt: Date.now() - 2 * 86_400_000, updatedAt: 2 }),
      frame({ id: 'a3', name: 'Annual toggle', stackId: 'a', createdAt: Date.now() - 86_400_000, updatedAt: 3, current: true, liveUrl: 'https://preview.example.com/' }),
      frame({ id: 'b', name: 'Three tiers', createdAt: 5, updatedAt: 5 }),
      frame({ id: 'k', name: 'Webflow', kind: 'url', url: 'https://x.webflow.io/', entry: undefined, frameBlocked: true, createdAt: 6, updatedAt: 6 }),
      frame({ id: 'u', name: 'Some site', kind: 'url', url: 'https://example.org/', entry: undefined, createdAt: 7, updatedAt: 7 }),
    ],
  };
  await store.load();
  history.replaceState(null, '', '#/');
});
afterEach(() => { clear(); vi.useRealTimers(); });

const open = async (id: string) => {
  const box = await mount(Router, {});
  await act(() => { openPrototype({ id }); });
  return box;
};

describe('the prototype view', () => {
  it('has the whole bar: star, note, versions, archive and zoom', async () => {
    const box = await open('b');
    for (const label of [/^Star, /, /^Note, /, /^Versions/, /^Archive, /, /^Zoom \d+%/, /^Zoom out/, /^Zoom in/]) expect(btn(box, label), String(label)).toBeTruthy();
  });

  it('puts Add a version in the Versions control, even with one version', async () => {
    const box = await open('b');
    const versions = btn(box, /^Versions/);
    expect(versions.disabled).toBe(false);
    await click(versions);
    expect(box.querySelector('.versions-pop')!.textContent).toContain('Only one version so far.');
    const add = box.querySelector('.add-version')!;
    expect(add.textContent).toContain('Add a version');
    expect(Array.from(add.querySelectorAll('button')).map((b) => b.textContent)).toEqual(['HTML or zip files…', 'A folder…', 'A link…', expect.stringMatching(/^Link a folder on your machine…/)]);
  });

  it('adds a link as a new version and shows it', async () => {
    const box = await open('b');
    await click(btn(box, /^Versions/));
    await click(Array.from(box.querySelectorAll('.add-version button')).find((b) => b.textContent === 'A link…')!);
    await flush();
    await flush();
    const made = db.writes.filter(([n, v]) => n === 'frames' && v.kind === 'url' && v.url === 'https://new.example/').at(-1)?.[1];
    expect(made).toBeTruthy();
    expect(stored(made.id).at(-1)!.stackId).toBe(stored('b').at(-1)!.stackId);
    expect(title(box)).toContain('Version 2 of 2');
  });

  it('carries the name, star, note, tags and archive state onto a version added from the view', async () => {
    db.lists.frames = db.lists.frames.map((f: any) => (f.id === 'b' ? { ...f, starred: true, note: 'Check the tiers', tags: ['pricing'], archived: true } : f));
    await store.load();
    const box = await open('b');
    await click(btn(box, /^Versions/));
    await click(Array.from(box.querySelectorAll('.add-version button')).find((b) => b.textContent === 'A link…')!);
    await flush();
    await flush();
    const made = db.writes.filter(([n, v]) => n === 'frames' && v.kind === 'url' && v.url === 'https://new.example/').at(-1)![1];
    const now = stored(made.id).at(-1)!;
    expect(now).toMatchObject({ name: 'Three tiers', starred: true, note: 'Check the tiers', archived: true });
    expect(now.tags).toEqual(expect.arrayContaining(['pricing']));
  });

  it('shows the whole note in the view, and nothing when there is none', async () => {
    db.lists.frames = db.lists.frames.map((f: any) => (f.id === 'b' ? { ...f, note: 'Check the tiers\nthen the footer' } : f));
    await store.load();
    const box = await open('b');
    expect(box.querySelector('.view-note-text')!.textContent).toBe('Check the tiers\nthen the footer');
    clear();
    expect((await open('u')).querySelector('.view-note-text')).toBeNull();
  });

  it('stars and notes in place, with no trip to another page', async () => {
    const box = await open('b');
    await click(btn(box, /^Star, /));
    await flush();
    expect(stored('b').at(-1)!.starred).toBe(true);
    await click(btn(box, /^Note, /));
    const field = box.querySelector<HTMLTextAreaElement>('textarea')!;
    field.value = 'Check the tiers';
    await act(() => { field.dispatchEvent(new Event('input', { bubbles: true })); });
    await key(field, 'Enter', { metaKey: true });
    await flush();
    expect(stored('b').at(-1)!.note).toBe('Check the tiers');
  });

  it('shows the Live switch for a stored copy with a live address, and not otherwise', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ type: 'opaque' }) as unknown as Response));
    const withLive = await open('a3');
    expect(withLive.querySelector('.live-btn')).toBeTruthy();
    expect(withLive.querySelector('[role="tooltip"]')!.textContent).toBe('Live shows the running version at its localhost address. Off shows the stored copy.');
    clear();
    const without = await open('b');
    expect(without.querySelector('.live-btn')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('opens a link in the same view, with the bar and an Open in new tab link', async () => {
    const box = await open('u');
    expect(btn(box, /^Star, /)).toBeTruthy();
    const a = Array.from(box.querySelectorAll('a')).find((x) => x.textContent === 'Open in new tab') as HTMLAnchorElement;
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('href')).toBe('https://example.org/');
  });

  it('Back and Escape return to where the person came from', async () => {
    history.replaceState(null, '', '#/starred');
    const box = await mount(Router, {});
    await act(() => { openPrototype({ id: 'b' }); });
    expect(location.hash).toBe('#/f/b/full');
    const back = vi.spyOn(history, 'back').mockImplementation(() => { history.replaceState(null, '', '#/starred'); dispatchEvent(new HashChangeEvent('hashchange')); });
    await click(btn(box, /^Back$/));
    expect(back).toHaveBeenCalledTimes(1);
    expect(box.querySelector('#elsewhere')!.textContent).toBe('#/starred');
    await act(() => { openPrototype({ id: 'b' }); });
    await key(window, 'Escape');
    expect(back).toHaveBeenCalledTimes(2);
    back.mockRestore();
  });

  it('goes to the project when it was opened from outside the app', async () => {
    history.replaceState(null, '', '#/f/b/full');
    const box = await mount(Router, {});
    await key(window, 'Escape');
    expect(location.hash).toBe('#/p/p1');
    expect(box).toBeTruthy();
  });

  it('leaves Escape to an open note', async () => {
    const box = await open('b');
    await click(btn(box, /^Note, /));
    await key(box.querySelector('textarea')!, 'Escape');
    expect(location.hash).toBe('#/f/b/full');
  });
});

describe('versions in the prototype view', () => {
  it('says which version is showing, and steps with the arrow keys', async () => {
    const box = await open('a3');
    expect(title(box)).toContain('Version 3 of 3');
    await key(window, 'ArrowLeft');
    expect(location.hash).toBe('#/f/a2/full');
    expect(title(box)).toContain('Version 2 of 3');
    await key(window, 'ArrowLeft');
    await key(window, 'ArrowLeft');
    expect(title(box)).toContain('Version 1 of 3');
    expect(btn(box, /^Previous version/).disabled).toBe(true);
    await click(btn(box, /^Next version/));
    expect(title(box)).toContain('Version 2 of 3');
  });

  it('leaves the arrow keys to a field', async () => {
    const box = await open('a3');
    await click(btn(box, /^Note, /));
    await key(box.querySelector('textarea')!, 'ArrowLeft');
    expect(title(box)).toContain('Version 3 of 3');
  });

  it('lists each version with its date and kind, and showing one changes nothing stored', async () => {
    const box = await open('a3');
    await click(btn(box, /^Versions of/));
    const rows = Array.from(box.querySelectorAll('.vrow')).map((r) => r.textContent);
    expect(rows).toEqual(['Version 3 · Yesterday · Stored copy · Current', expect.stringMatching(/^Version 2 · .+ · Link$/), expect.stringMatching(/^Version 1 · .+ · Stored copy$/)]);
    await click(box.querySelectorAll('.vrow')[2]);
    expect(title(box)).toContain('Version 1 of 3');
    expect(db.writes.filter(([n]) => n === 'frames')).toEqual([]);
  });

  it('changes the current version only through its own action', async () => {
    const box = await open('a2');
    await click(btn(box, /^Versions of/));
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Make this the current version')!);
    await flush();
    expect(stored('a2').at(-1)!.current).toBe(true);
    expect(stored('a3').at(-1)!.current).toBe(false);
  });
});

describe('a page that will not show', () => {
  it('says so when the version is known to refuse framing, with a way out', async () => {
    const box = await open('k');
    expect(box.querySelector('iframe')).toBeNull();
    expect(box.querySelector('.frame-blocked')!.textContent).toContain('This site does not allow itself to be shown inside other pages.');
    expect(box.querySelector('.frame-blocked a')!.getAttribute('href')).toBe('https://x.webflow.io/');
  });

  const hints = (box: HTMLElement) => Array.from(box.querySelectorAll('.view-hints'));

  it('always shows a bar above a link, and offers Open in new tab once, in the toolbar', async () => {
    const box = await open('u');
    const bar = box.querySelector('.link-bar')!;
    expect(bar.textContent).toContain('the site may not allow being shown inside other pages');
    expect(bar.querySelector('a')).toBeNull();
    const opens = Array.from(box.querySelectorAll('a')).filter((a) => /open in (a )?new tab/i.test(a.getAttribute('aria-label') ?? a.textContent ?? ''));
    expect(opens).toHaveLength(1);
    expect(opens[0].getAttribute('href')).toBe('https://example.org/');
    expect(opens[0].getAttribute('target')).toBe('_blank');
    expect(opens[0].getAttribute('rel')).toBe('noopener');
    expect(box.querySelector('.slow')).toBeNull();
  });

  it('keeps the bar after the frame loads and after time passes', async () => {
    vi.useFakeTimers();
    const box = await open('u');
    await act(() => { box.querySelector('iframe')!.dispatchEvent(new Event('load')); });
    await act(() => { vi.advanceTimersByTime(5000); });
    expect(box.querySelector('.link-bar')).not.toBeNull();
  });

  it('has no way out line for a stored copy, and a blocked link keeps its fuller message instead', async () => {
    const stored = await open('b');
    expect(stored.querySelector('.view-hints')!.textContent).toBe('');
    expect(stored.querySelector('.link-bar')).toBeNull();
    clear();
    const blocked = await open('k');
    expect(blocked.querySelector('.view-hints')!.textContent).toBe('');
    expect(blocked.querySelector('.frame-blocked')).not.toBeNull();
    expect(blocked.querySelector('.link-bar')).toBeNull();
  });

  it('reserves the line in every view, so nothing moves when it appears', async () => {
    const box = await open('b');
    expect(hints(box)).toHaveLength(1);
    const css = (await import('node:fs')).readFileSync('src/app/app.css', 'utf8');
    expect(css).toMatch(/\.view-hints\s*\{[^}]*min-height:/);
  });

  it('shows every hint that applies as one line in one place', async () => {
    const box = await open('a2');
    expect(box.querySelectorAll('.view-note')).toHaveLength(1);
    expect(hints(box)).toHaveLength(1);
    const text = box.querySelector('.view-hints')!.textContent!;
    expect(text).toContain('not the current version');
  });
});
