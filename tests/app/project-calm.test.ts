// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async () => {},
}));

import * as store from '../../src/app/store';
import { ProjectView } from '../../src/app/ui';
import { clear, click, fire, frame, mount, project } from './helpers/dom';

const seed = (frames: ReturnType<typeof frame>[]) => {
  db.lists = { projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [], frames };
};
const view = async () => {
  await store.load();
  return mount(ProjectView, { id: 'p1', tab: 'prototypes' as const, askUrl: async () => null });
};
const dragOver = (el: Element) => {
  const e = new Event('dragover', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'] } });
  return fire(el, e);
};

afterEach(clear);

describe('the project page header', () => {
  it('is a title row and one toolbar row, with the one Add pill on the title row', async () => {
    seed([frame({ id: 'a', name: 'Annual toggle' })]);
    const box = await view();
    const top = box.querySelector('.topbar')!;
    expect(top.querySelector('.crumb input')).toBeTruthy();
    expect(top.querySelector('button.add')!.textContent).toBe('Add');
    expect(box.querySelectorAll('button.add')).toHaveLength(1);
    const bar = box.querySelector('.lib-bar')!;
    expect(bar.querySelector('input[placeholder="Search prototypes"]')).toBeTruthy();
    expect(bar.querySelector('button.add')).toBeNull();
    expect(bar.querySelector('select[aria-label="Sort"]')).toBeTruthy();
    expect(bar.querySelector('[aria-label="View"]')).toBeTruthy();
    expect(box.querySelector('.board-chips')).toBeNull();
  });

  it('still opens the Prototypes, Boards and Notes tabs from the title row', async () => {
    seed([frame({ id: 'a', name: 'Annual toggle' })]);
    const box = await view();
    expect(Array.from(box.querySelectorAll('.topbar .tabs a')).map((a) => a.textContent?.replace(/\d+$/, '').trim())).toEqual(['Prototypes', 'Boards', 'Notes']);
  });
});

describe('the drop box', () => {
  it('shows only when the project is empty', async () => {
    seed([]);
    const empty = await view();
    expect(empty.querySelector('[data-drop-hint]')).toBeTruthy();
    clear();
    seed([frame({ id: 'a', name: 'Annual toggle' })]);
    const full = await view();
    expect(full.querySelector('[data-drop-hint]')).toBeNull();
  });

  it('is replaced by a full-page overlay while files are dragged over a project that has work', async () => {
    seed([frame({ id: 'a', name: 'Annual toggle' })]);
    const box = await view();
    expect(box.querySelector('.dropzone')).toBeNull();
    await dragOver(box.querySelector('.library')!);
    expect(box.querySelector('.main > .dropzone')!.textContent).toBe('Drop to add to Pricing');
  });
});

describe('filters stay reachable', () => {
  it('opens the popover from the keyboard focusable Filter pill and closes it with Escape', async () => {
    seed([frame({ id: 'a', name: 'Annual toggle' })]);
    const box = await view();
    const pill = Array.from(box.querySelectorAll<HTMLButtonElement>('.lib-bar button')).find((b) => b.textContent?.startsWith('Filter'))!;
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    await click(pill);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    const { key } = await import('./helpers/dom');
    await key(box.querySelector('#filter-panel')!, 'Escape');
    expect(box.querySelector('#filter-panel')).toBeNull();
  });

  it('closes when focus moves on to another control, and stays open while it moves between options', async () => {
    seed([frame({ id: 'a', name: 'Annual toggle' })]);
    const box = await view();
    const pill = Array.from(box.querySelectorAll<HTMLButtonElement>('.lib-bar button')).find((b) => b.textContent?.startsWith('Filter'))!;
    await click(pill);
    const options = box.querySelectorAll<HTMLButtonElement>('#filter-panel button');
    const out = (relatedTarget: Element) => fire(options[0], new FocusEvent('focusout', { bubbles: true, relatedTarget }));
    await out(options[1]);
    expect(box.querySelector('#filter-panel')).toBeTruthy();
    await out(box.querySelector('select[aria-label="Sort"]')!);
    expect(box.querySelector('#filter-panel')).toBeNull();
  });
});
