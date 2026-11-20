// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(db.tables[n] ?? []),
  put: async () => {},
  remove: async () => {},
}));

import * as store from '../../src/app/store';
import { App } from '../../src/app/ui';
import { clear, click, fire, mount, type } from './helpers/dom';

const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));
const by = (box: ParentNode, sel: string, text: RegExp) => Array.from(box.querySelectorAll<HTMLElement>(sel)).find((e) => text.test(e.textContent ?? ''))!;

beforeEach(async () => {
  db.tables = { projects: [], boards: [], frames: [], placements: [], notes: [], agents: [] };
  await store.load();
  history.replaceState(null, '', '#/');
});
afterEach(clear);

describe('the first-run Add a link', () => {
  it('creates no project when the dialog is cancelled, so Try the sample project stays', async () => {
    const box = await mount(App, {});
    await click(by(box, '.first-link button', /Add a link/));
    await flush();
    await click(by(box, '[role="dialog"] button', /Cancel/));
    await flush();
    expect(store.getState().projects).toEqual([]);
    expect(by(box, 'button.sample', /Try the sample project/)).toBeTruthy();
  });

  it('creates My prototypes once there is a link to add', async () => {
    const box = await mount(App, {});
    await click(by(box, '.first-link button', /Add a link/));
    await flush();
    await type(box.querySelector<HTMLInputElement>('#url-address')!, 'example.com/page');
    await fire(box.querySelector('form')!, new Event('submit', { bubbles: true, cancelable: true }));
    await flush();
    expect(store.getState().projects.map((p) => p.name)).toEqual(['My prototypes']);
    expect(store.getState().frames).toHaveLength(1);
  });
});
