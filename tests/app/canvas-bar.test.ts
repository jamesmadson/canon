// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h } from 'preact';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { PrototypeActions, ZoomControls } from '../../src/app/bar';
import { useStore } from '../../src/app/shared';
import { clear, click, frame, key, mount, nameOf, project, type, unnamed } from './helpers/dom';

const Bar = ({ id }: { id: string | null }) => {
  const s = useStore();
  return h(PrototypeActions, { frame: id ? s.frames.find((f) => f.id === id) : undefined });
};
const flush = () => new Promise((r) => setTimeout(r, 0));
const stored = (id: string) => db.writes.filter(([n, v]) => n === 'frames' && v.id === id).map(([, v]) => v);

beforeEach(async () => {
  db.writes = [];
  db.lists = {
    projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [],
    frames: [
      frame({ id: 'a', name: 'Annual toggle', stackId: 'a', createdAt: 1, updatedAt: 1 }),
      frame({ id: 'a2', name: 'Annual toggle v2', stackId: 'a', createdAt: 2, updatedAt: 2 }),
      frame({ id: 'b', name: 'Three tiers', note: 'Ask Sam', createdAt: 3, updatedAt: 3 }),
    ],
  };
  await store.load();
});
afterEach(clear);

const btn = (box: HTMLElement, label: RegExp) => Array.from(box.querySelectorAll<HTMLButtonElement>('button')).find((b) => label.test(nameOf(b)))!;

describe('the canvas bottom bar', () => {
  it('stars the selected prototype, across its versions, and shows it pressed', async () => {
    const box = await mount(Bar, { id: 'a2' });
    const star = btn(box, /^Star /);
    expect(nameOf(star)).toBe('Star Annual toggle v2');
    expect(star.getAttribute('aria-pressed')).toBe('false');
    await click(star);
    await flush();
    expect(stored('a').at(-1)!.starred).toBe(true);
    expect(stored('a2').at(-1)!.starred).toBe(true);
    expect(btn(box, /^Star /).getAttribute('aria-pressed')).toBe('true');
    await click(btn(box, /^Star /));
    await flush();
    expect(stored('a2').at(-1)!.starred).toBe(false);
  });

  it('archives and unarchives, and says what happened', async () => {
    const box = await mount(Bar, { id: 'b' });
    await click(btn(box, /^Archive /));
    await flush();
    expect(stored('b').at(-1)!.archived).toBe(true);
    expect(btn(box, /^Archive /).getAttribute('aria-pressed')).toBe('true');
    expect(store.getState().toast).toMatch(/^Archived Three tiers\./);
    await click(btn(box, /^Archive /));
    await flush();
    expect(stored('b').at(-1)!.archived).toBe(false);
    expect(store.getState().toast).toBe('Three tiers is back in Home and the project list.');
  });

  it('opens the prototype note with its text, saves a change, and returns focus to the button', async () => {
    const box = await mount(Bar, { id: 'b' });
    const open = btn(box, /^Prototype note for/);
    expect(nameOf(open)).toBe('Prototype note for Three tiers, has text');
    await click(open);
    const field = box.querySelector<HTMLTextAreaElement>('textarea')!;
    expect(field.value).toBe('Ask Sam');
    expect(document.activeElement).toBe(field);
    expect(nameOf(field)).toBe('Prototype note for Three tiers');
    await type(field, 'Ask Sam about the copy');
    await key(field, 'Escape');
    await flush();
    expect(stored('b').at(-1)!.note).toBe('Ask Sam about the copy');
    expect(box.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(btn(box, /^Prototype note for/));
  });

  it('writes nothing when the note is left as it was, or cancelled', async () => {
    const box = await mount(Bar, { id: 'b' });
    await click(btn(box, /^Prototype note for/));
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Cancel')!);
    await click(btn(box, /^Prototype note for/));
    await key(box.querySelector('textarea')!, 'Escape');
    await flush();
    expect(stored('b')).toEqual([]);
  });

  it('keeps a typed note when another prototype is selected', async () => {
    const box = await mount(Bar, { id: 'b' });
    await click(btn(box, /^Prototype note for/));
    await type(box.querySelector('textarea')!, 'Changed my mind');
    // The selection moves to another prototype: the bar re-renders for it.
    const { render } = await import('preact');
    const { act } = await import('preact/test-utils');
    await act(() => { render(h(Bar, { id: 'a2' }), box); });
    await flush();
    expect(stored('b').at(-1)!.note).toBe('Changed my mind');
    expect(box.querySelector('textarea')).toBeNull();
  });

  it('is disabled, and says why, when nothing is selected', async () => {
    const box = await mount(Bar, { id: null });
    for (const b of box.querySelectorAll<HTMLButtonElement>('button')) {
      expect(b.disabled).toBe(true);
      expect(nameOf(b)).toMatch(/select a prototype first$/);
    }
    expect(box.querySelectorAll('button').length).toBe(3);
  });

  it('has a name on every control, open or closed', async () => {
    const box = await mount(Bar, { id: 'b' });
    expect(unnamed(box)).toEqual([]);
    await click(btn(box, /^Prototype note for/));
    expect(unnamed(box)).toEqual([]);
  });
});

describe('where the bar appears', () => {
  it('is in the bottom bar of a board and of a multi-page prototype', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/app/canvas.ts', 'utf8');
    expect(src.match(/<\$\{PrototypeActions\} frame=/g)).toHaveLength(2);
    expect(src.match(/<\$\{ZoomControls\} zoom=/g)).toHaveLength(2);
    // The board bar acts on the selected prototype, the page view bar on its prototype.
    expect(src).toContain('<${PrototypeActions} frame=${sel ?? undefined} />');
    expect(src).toContain('<${PrototypeActions} frame=${frame} />');
  });
});

describe('zoom', () => {
  it('zooms out, resets, zooms in and fits, each by name', async () => {
    const calls: string[] = [];
    const box = await mount(ZoomControls, { zoom: 0.5, onOut: () => calls.push('out'), onIn: () => calls.push('in'), onReset: () => calls.push('reset'), onFit: () => calls.push('fit') });
    for (const label of ['Zoom out', 'Zoom 50%, press for 100%', 'Zoom in', 'Fit everything']) await click(btn(box, new RegExp(`^${label}$`)));
    expect(calls).toEqual(['out', 'reset', 'in', 'fit']);
    expect(box.textContent).toContain('50%');
    expect(unnamed(box)).toEqual([]);
  });

  it('shows just the percentage and fit when the view cannot zoom by steps', async () => {
    const box = await mount(ZoomControls, { zoom: 0.3, onFit: () => {} });
    expect(box.querySelectorAll('button').length).toBe(2);
    expect(nameOf(box.querySelector('.zoom')!)).toBe('Zoom 30%, press to fit');
  });
});
