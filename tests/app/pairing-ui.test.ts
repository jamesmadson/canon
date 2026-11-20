// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, type ComponentType } from 'preact';
import { act } from 'preact/test-utils';

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
const table = (n: string) => (db.tables[n] ??= []);
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(table(n)),
  put: async (n: string, v: any) => { const t = table(n); const i = t.findIndex((x) => x.id === v.id); if (i >= 0) t[i] = v; else t.push(v); },
  remove: async () => {},
  get: async () => undefined,
}));

import * as store from '../../src/app/store';
import { App } from '../../src/app/ui';
import { CHROME_BLOCKED, connectionOutcome, localNetworkDenied } from '../../src/app/bridge/client';
import { clear, click, mount } from './helpers/dom';

const secret = 'ab'.repeat(32);
const link = `#pair=claude-code.47801.${secret}&name=Claude%20Code`;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  db.tables = { projects: [], boards: [], frames: [], placements: [], notes: [], agents: [] };
  await store.load();
  history.replaceState(null, '', '#/');
});
// Unmount, so an earlier App's hashchange listener does not eat the next test's link.
afterEach(() => { document.body.querySelectorAll(':scope > div').forEach((b) => render(null, b)); clear(); });

describe('a pairing link that arrives in an open Canon tab', () => {
  it('opens the pairing dialog, as a fresh load does, and clears the secret from the address', async () => {
    const box = await mount(App as ComponentType<any>, {});
    expect(box.querySelector('[role="dialog"]')).toBeNull();
    await act(() => { location.hash = link; });
    await flush();
    const dialog = box.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.textContent).toContain('Connect Claude Code to Canon?');
    expect(location.hash).not.toContain('pair=');
    expect(store.getState().toast).toBeNull();
  });

  it('says a malformed link connected nothing', async () => {
    const box = await mount(App as ComponentType<any>, {});
    await act(() => { location.hash = '#pair=nope'; });
    await flush();
    expect(box.querySelector('[role="dialog"]')).toBeNull();
    expect(store.getState().toast).toContain('incomplete');
  });
});

describe('when the agent never answers', () => {
  it('replaces the waiting toast with a way to fix it after 20 seconds', async () => {
    const box = await mount(App as ComponentType<any>, {});
    await act(() => { location.hash = link; });
    await flush();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const connect = Array.from(box.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find((b) => b.textContent === 'Connect')!;
      await click(connect);
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(store.getState().toast).toBe('Saved Claude Code. Waiting for it to answer.');
      await act(async () => { await vi.advanceTimersByTimeAsync(20_001); });
      expect(store.getState().toast).toBe("Canon couldn't reach your agent. Check that it is running and that Chrome allows local network access for this site, then reload.");
    } finally { vi.useRealTimers(); }
  });
});

describe('when an agent counts as connected', () => {
  it('only after a signed answer came back', () => {
    expect(connectionOutcome({ connected: new Set(), blocked: false }, 'a')).toBeNull();
    expect(connectionOutcome({ connected: new Set(['a']), blocked: false }, 'a')).toBe('connected');
    expect(connectionOutcome({ connected: new Set(['b']), blocked: false }, 'a')).toBeNull();
  });
  it('says Chrome is blocking it when the request is refused by the browser', () => {
    expect(connectionOutcome({ connected: new Set(), blocked: true }, 'a')).toBe('blocked');
    expect(CHROME_BLOCKED).toBe('Chrome is blocking Canon from reaching your agent. Allow local network access for this site, then reload.');
  });
});

describe('localNetworkDenied', () => {
  it('is true when the browser reports the permission as denied', async () => {
    expect(await localNetworkDenied(async () => ({ state: 'denied' }))).toBe(true);
  });
  it('is false when allowed, asked for, or a name the browser does not know', async () => {
    expect(await localNetworkDenied(async () => ({ state: 'granted' }))).toBe(false);
    expect(await localNetworkDenied(async () => ({ state: 'prompt' }))).toBe(false);
    expect(await localNetworkDenied(async () => { throw new TypeError('unknown'); })).toBe(false);
  });
});
