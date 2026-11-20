// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'preact';
import { act } from 'preact/test-utils';

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(db.tables[n] ?? []),
  put: async (n: string, v: any) => { db.writes.push([n, v]); },
  remove: async () => {},
}));

import * as store from '../../src/app/store';
import { App } from '../../src/app/ui';
import { clear, click, fire, frame, key, mount, nameOf, project, type } from './helpers/dom';

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));
const dialog = (box: HTMLElement) => box.querySelector<HTMLElement>('[role="dialog"][aria-label="Rename prototype"]');
const field = (box: HTMLElement) => box.querySelector<HTMLInputElement>('#rename-name')!;
const submit = (box: HTMLElement) => fire(dialog(box)!, new Event('submit', { bubbles: true, cancelable: true }));
const nameNow = (id: string) => store.getState().frames.find((f) => f.id === id)!.name;

beforeEach(async () => {
  db.writes = [];
  db.tables = {
    projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [], agents: [],
    frames: [
      frame({ id: 'a1', name: 'Annual toggle', stackId: 'a', createdAt: 1, updatedAt: 1 }),
      frame({ id: 'a2', name: 'Annual toggle', stackId: 'a', createdAt: 2, updatedAt: 2, current: true }),
      frame({ id: 'b', name: 'Three tiers', createdAt: 5, updatedAt: 5 }),
    ],
  };
  await store.load();
  history.replaceState(null, '', '#/p/p1');
});
afterEach(clear);

describe('renameFrame', () => {
  it('renames every version of the prototype', async () => {
    expect(await store.renameFrame('a2', '  Yearly toggle ')).toBe(true);
    expect(nameNow('a1')).toBe('Yearly toggle');
    expect(nameNow('a2')).toBe('Yearly toggle');
    expect(nameNow('b')).toBe('Three tiers');
  });
  it('refuses an empty name and changes nothing', async () => {
    expect(await store.renameFrame('b', '   ')).toBe(false);
    expect(nameNow('b')).toBe('Three tiers');
  });
});

describe('Rename in a row menu', () => {
  const openRename = async (box: HTMLElement, name: string) => {
    await click(box.querySelector(`button[aria-label="More actions for ${name}"]`)!);
    await click(Array.from(box.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((b) => b.textContent!.trim() === 'Rename')!);
  };

  it('opens a small dialog with the name selected, and Enter saves it', async () => {
    const box = await mount(App as ComponentType<any>, {});
    await openRename(box, 'Three tiers');
    expect(dialog(box)).not.toBeNull();
    expect(field(box).value).toBe('Three tiers');
    expect(document.activeElement).toBe(field(box));
    await type(field(box), 'Pricing tiers');
    await submit(box);
    await flush();
    expect(dialog(box)).toBeNull();
    expect(nameNow('b')).toBe('Pricing tiers');
  });

  it('closes on Esc without renaming', async () => {
    const box = await mount(App as ComponentType<any>, {});
    await openRename(box, 'Three tiers');
    await type(field(box), 'Changed');
    await key(window, 'Escape');
    expect(dialog(box)).toBeNull();
    expect(nameNow('b')).toBe('Three tiers');
  });

  it('refuses an empty name with a message under the field and keeps the dialog open', async () => {
    const box = await mount(App as ComponentType<any>, {});
    await openRename(box, 'Three tiers');
    await type(field(box), '  ');
    await submit(box);
    await flush();
    expect(dialog(box)).not.toBeNull();
    expect(box.querySelector('#rename-error')!.textContent).toBe('Enter a name, then save.');
    expect(field(box).getAttribute('aria-invalid')).toBe('true');
    expect(nameNow('b')).toBe('Three tiers');
  });
});

describe('Rename in the prototype view', () => {
  it('has a Rename button next to the name that opens the same dialog', async () => {
    history.replaceState(null, '', '#/f/b/full');
    const box = await mount(App as ComponentType<any>, {});
    const button = Array.from(box.querySelectorAll('button')).find((b) => nameOf(b) === 'Rename Three tiers')!;
    expect(button).toBeTruthy();
    await click(button);
    expect(dialog(box)).not.toBeNull();
    await type(field(box), 'Tiers');
    await submit(box);
    await flush();
    expect(box.querySelector('h2.vb-name')!.textContent).toBe('Tiers');
  });
});
