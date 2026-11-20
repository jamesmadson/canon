// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';

vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async () => [],
  put: async () => {},
}));

import * as store from '../../src/app/store';
import { useStore } from '../../src/app/shared';
import { clear } from './helpers/dom';

const Probe = () => {
  useStore();
  return h('span', { id: 'probe' }, store.canInstall() ? 'can install' : 'cannot');
};

afterEach(() => { store.setInstallPrompt(null); clear(); });

describe('useStore', () => {
  it('redraws for a change that lands between the first draw and subscribing', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    // Preact runs effects after the paint, so this change lands in the gap.
    render(h(Probe, {}), box);
    expect(box.textContent).toBe('cannot');
    store.setInstallPrompt({ prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) } as never);
    await new Promise((r) => setTimeout(r, 50));
    expect(box.textContent).toBe('can install');
  });

  it('still redraws for a change after it has subscribed', async () => {
    const box = document.createElement('div');
    document.body.appendChild(box);
    render(h(Probe, {}), box);
    await new Promise((r) => setTimeout(r, 50));
    store.setInstallPrompt({ prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) } as never);
    await new Promise((r) => setTimeout(r, 50));
    expect(box.textContent).toBe('can install');
  });
});
