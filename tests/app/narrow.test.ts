// @vitest-environment jsdom
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(db.tables[n] ?? []),
  put: async () => {},
  remove: async () => {},
}));

import * as store from '../../src/app/store';
import { App } from '../../src/app/ui';
import { clear, click, mount } from './helpers/dom';

beforeEach(async () => {
  db.tables = { projects: [], boards: [], frames: [], placements: [], notes: [], agents: [] };
  await store.load();
  history.replaceState(null, '', '#/');
});
afterEach(() => { clear(); vi.unstubAllGlobals(); });

describe('the screen for a window under 760px', () => {
  it('says the window is too narrow, how to fix it, and has a Copy link button', async () => {
    const box = await mount(App, {});
    const narrow = box.querySelector('.narrow')!;
    expect(narrow.querySelector('h1')!.textContent).toBe('Canon needs a wider window');
    expect(narrow.querySelector('p')!.textContent).toBe('Widen the window or open Canon on a laptop.');
    const buttons = Array.from(narrow.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Copy link']);
  });

  it('copies the address of the app, not a pairing link or a route', async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    history.replaceState(null, '', '/canon/app/#/p/p1');
    const box = await mount(App, {});
    const copy = box.querySelector<HTMLButtonElement>('.narrow button')!;
    await click(copy);
    await act(() => new Promise<void>((r) => setTimeout(r, 0)));
    expect(writeText).toHaveBeenCalledWith(location.origin + '/canon/app/');
    expect(copy.textContent).toBe('Copied');
  });
});
