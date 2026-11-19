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
import { tagsForBar } from '../../src/app/lib/viewer';
import { readFileSync } from 'node:fs';
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

const css = readFileSync('src/app/app.css', 'utf8');

beforeEach(async () => {
  resetLive();
  db.writes = [];
  db.lists = {
    projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [],
    frames: [
      frame({ id: 'a1', name: 'Annual toggle', stackId: 'a', createdAt: 1, updatedAt: 1 }),
      frame({ id: 'a2', name: 'Annual toggle', stackId: 'a', createdAt: 2, updatedAt: 2, current: true, tags: ['Pricing', 'Billing', 'Forms', 'Mobile', 'Search'], liveUrl: 'https://preview.example.com/' }),
      frame({ id: 'b', name: 'Three tiers', createdAt: 5, updatedAt: 5, tags: ['Pricing'] }),
    ],
  };
  await store.load();
  history.replaceState(null, '', '#/');
});
afterEach(clear);

const open = async (id: string) => {
  const box = await mount(Router, {});
  await act(() => { openPrototype({ id }); });
  return box;
};
const labels = (el: Element) => Array.from(el.querySelectorAll('button, a')).map((b) => nameOf(b));

describe('the bottom bar of the prototype view', () => {
  it('has the name, the version line and the tags on the left, and the actions on the right', async () => {
    const bar = (await open('a2')).querySelector('.viewer-bar')!;
    expect(bar.querySelector('.vb-id .vb-name')!.textContent).toBe('Annual toggle');
    expect(bar.querySelector('.vb-id .vb-vtext')!.textContent).toBe('Version 2 of 2');
    expect(bar.querySelector('.vb-acts')).toBeTruthy();
    expect(bar.querySelector('.vb-id .vb-ver')).toBeTruthy();
  });

  it('keeps the previous and next controls with the version line, not in the top bar', async () => {
    const box = await open('a2');
    expect(box.querySelectorAll('.topbar [aria-label="Previous version"], .topbar [aria-label="Next version"]')).toHaveLength(0);
    const step = box.querySelector('.viewer-bar .vb-ver')!;
    expect(labels(step)).toEqual(['Previous version', 'Next version']);
    await click(step.querySelector<HTMLButtonElement>('[aria-label="Previous version"]')!);
    expect(location.hash).toBe('#/f/a1/full');
    expect(box.querySelector('.vb-vtext')!.textContent).toBe('Version 1 of 2');
  });

  it('shows no version line for a prototype with one version', async () => {
    const box = await open('b');
    expect(box.querySelector('.vb-ver')).toBeNull();
  });

  it('puts Note, Star, Versions and Archive on the right with a word beside each icon, then zoom, then Live', async () => {
    const acts = (await open('a2')).querySelector('.vb-acts')!;
    const order = labels(acts);
    const at = (re: RegExp) => order.findIndex((l) => re.test(l));
    expect(at(/^Prototype note for/)).toBeLessThan(at(/^Star /));
    expect(at(/^Star /)).toBeLessThan(at(/^Versions of/));
    expect(at(/^Versions of/)).toBeLessThan(at(/^Archive /));
    expect(at(/^Archive /)).toBeLessThan(at(/^Zoom out/));
    expect(at(/^Fit everything/)).toBeLessThan(order.indexOf('Live'));
    expect(Array.from(acts.querySelectorAll('.lbl')).map((l) => l.textContent)).toEqual(['Note', 'Star', 'Versions', 'Archive']);
  });

  it('reads Starred with a filled icon when on, and never marks it orange', async () => {
    const box = await open('b');
    const star = () => box.querySelector<HTMLButtonElement>('.vb-star')!;
    expect(star().querySelector('.lbl')!.textContent).toBe('Star');
    expect(star().querySelector('svg')!.getAttribute('fill')).toBe('none');
    await click(star());
    await new Promise((r) => setTimeout(r, 0));
    expect(star().querySelector('.lbl')!.textContent).toBe('Starred');
    expect(star().getAttribute('aria-pressed')).toBe('true');
    expect(star().querySelector('svg')!.getAttribute('fill')).toBe('currentColor');
    expect(css).not.toMatch(/\.viewer-bar[^{]*\[aria-pressed="true"\][^{]*\{[^}]*accent/);
  });

  it('names every control without its word, and gives each a tooltip', async () => {
    const box = await open('a2');
    for (const b of Array.from(box.querySelectorAll('.viewer-bar button:not(.live-btn)'))) {
      expect(nameOf(b), b.outerHTML.slice(0, 80)).toBeTruthy();
      expect(b.getAttribute('title') || b.getAttribute('aria-label'), b.outerHTML.slice(0, 80)).toBeTruthy();
    }
    expect(box.querySelector('.vb-note')!.getAttribute('title')).toBe('Note');
    expect(box.querySelector('.vb-archive')!.getAttribute('title')).toBe('Archive');
  });

  it('shows the first three tags, then +N, with a count that stands in when the bar is narrow', async () => {
    const box = await open('a2');
    expect(Array.from(box.querySelectorAll('.vb-tags .tag')).map((t) => t.textContent)).toEqual(['Pricing', 'Billing', 'Forms', '+2']);
    expect(box.querySelector('.vb-tagcount')!.textContent).toBe('5 tags');
    expect(tagsForBar(['a', 'b'])).toEqual({ shown: ['a', 'b'], more: 0 });
  });

  it('is the same bar on the page map', async () => {
    db.lists.frames = [frame({ id: 'm', name: 'Many pages', pages: ['index.html', 'a.html', 'b.html', 'c.html'], tags: ['Pricing'] })];
    await store.load();
    const box = await open('m');
    expect(box.querySelector('.map-board')).toBeTruthy();
    expect(box.querySelector('.viewer-bar .vb-name')!.textContent).toBe('Many pages');
    expect(box.querySelectorAll('.viewer-bar')).toHaveLength(1);
  });

  it('keeps the name as the view\'s heading for screen readers, and out of the top bar', async () => {
    const box = await open('a2');
    const h1 = box.querySelector('h1')!;
    expect(h1.classList.contains('sr')).toBe(true);
    expect(h1.textContent).toContain('Annual toggle');
    expect(box.querySelector('.topbar .vb-name')).toBeNull();
  });
});

describe('how the bar gives way as it narrows', () => {
  const queries = [...css.matchAll(/@container \(max-width: (\d+)px\)\s*\{([\s\S]*?)\n\}/g)].map((m) => ({ width: Number(m[1]), body: m[2] }));
  const hidesLabelAt = (cls: string) => queries.find((q) => new RegExp(`\\.viewer-bar \\.${cls} \\.lbl \\{ display: none; \\}`).test(q.body))?.width ?? 0;

  it('drops the words in a set order: Archive, then Versions, then Star, then Note last', () => {
    const [archive, versions, star, note] = ['vb-archive', 'vb-versions', 'vb-star', 'vb-note'].map(hidesLabelAt);
    expect(note).toBeGreaterThan(0);
    expect(archive).toBeGreaterThan(versions);
    expect(versions).toBeGreaterThan(star);
    expect(star).toBeGreaterThan(note);
  });

  it('turns the tags into a count before any word goes', () => {
    const tags = queries.find((q) => /\.vb-tags \{ display: none; \}/.test(q.body))!.width;
    expect(tags).toBeGreaterThan(hidesLabelAt('vb-archive'));
    expect(queries.find((q) => q.width === tags)!.body).toMatch(/\.vb-tagcount \{ display: inline-flex; \}/);
  });

  it('never lets the bar wrap', () => {
    expect(css).toMatch(/\.viewer-bar \{[^}]*display: flex[^}]*\}/);
    expect(css).not.toMatch(/\.viewer-bar \{[^}]*flex-wrap: wrap/);
    expect(css).toMatch(/\.vb-name \{[^}]*white-space: nowrap/);
  });
});
