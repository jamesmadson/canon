import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, any[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async () => {},
}));

import * as store from '../../src/app/store';
import { refusesFraming } from '../../src/app/lib/framing';
import { project } from './helpers/dom';

describe('refusesFraming', () => {
  it('knows the hosts that refuse and their subdomains', () => {
    for (const u of ['https://v0.app/chat/x', 'https://v0.dev/', 'https://lovable.dev/p', 'https://www.figma.com/proto/abc', 'https://my-app.lovable.dev/', 'https://FIGMA.com/'])
      expect(refusesFraming(u), u).toBe(true);
  });
  it('leaves other hosts alone, including look-alikes', () => {
    for (const u of ['https://example.com/', 'https://notfigma.com/', 'https://figma.com.evil.test/', 'https://v0.app.example/', 'not a url', ''])
      expect(refusesFraming(u), u).toBe(false);
  });
});

describe('a link a person adds', () => {
  beforeEach(async () => {
    db.lists = { projects: [project('p1', 'Pricing')], boards: [], placements: [], notes: [], frames: [] };
    await store.load();
  });

  it('is marked as refusing framing when its host is known to', async () => {
    const f = await store.addUrl('p1', 'https://v0.app/chat/abc');
    expect(f.frameBlocked).toBe(true);
    expect(store.getState().frames.find((x) => x.id === f.id)!.frameBlocked).toBe(true);
  });

  it('is not marked for other hosts', async () => {
    const f = await store.addUrl('p1', 'https://example.org/');
    expect(f.frameBlocked).toBeUndefined();
  });
});
