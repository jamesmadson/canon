// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const picker = vi.hoisted(() => vi.fn());

import * as vault from '../../src/app/vault';
import * as store from '../../src/app/store';
import { Sidebar } from '../../src/app/sidebar';
import { clear, mount } from './helpers/dom';

afterEach(() => { clear(); vi.restoreAllMocks(); });

const rail = () => mount(Sidebar, { route: { name: 'home' } as any, activeProject: null });

describe('the folder library is parked', () => {
  it('offers no Save to a folder, Reconnect or Stop saving, only Back up and Restore', async () => {
    for (const status of ['none', 'unsupported', 'needs-permission', 'connected'] as const) {
      store.setVault(status === 'connected' ? { status, name: 'x', saving: false } as any : status === 'needs-permission' ? { status, name: 'x' } as any : { status });
      const box = await rail();
      const labels = Array.from(box.querySelectorAll('.store button')).map((b) => b.textContent?.trim());
      expect(labels).toEqual(['Back up', 'Restore']);
      expect(box.querySelector('.store')!.textContent).toContain('Only in this browser');
      clear();
    }
  });

  it('never opens the folder picker or connects on start', async () => {
    (window as any).showDirectoryPicker = picker;
    await vault.initVault();
    expect(picker).not.toHaveBeenCalled();
    expect(store.getState().vault.status).toBe('unsupported');
    expect(vault.FOLDER_LIBRARY).toBe(false);
  });
});
