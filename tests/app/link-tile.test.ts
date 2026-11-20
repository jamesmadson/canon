// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, any[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async () => {},
  remove: async () => {},
}));

import { hostOf, monogramOf } from '../../src/app/lib/linktile';
import { LinkTile } from '../../src/app/parts';
import { Library } from '../../src/app/ui';
import * as store from '../../src/app/store';
import { clear, frame, mount, project } from './helpers/dom';

afterEach(clear);

describe('the picture of a link with no screenshot', () => {
  it('reads the host without www, and a first letter from it', () => {
    expect(hostOf('https://www.vercel.com/templates')).toBe('vercel.com');
    expect(hostOf('http://localhost:5173/')).toBe('localhost:5173');
    expect(hostOf('not a link')).toBe('');
    expect(monogramOf('https://v0.dev', 'x')).toBe('V');
    expect(monogramOf(undefined, '  pricing page')).toBe('P');
    expect(monogramOf(undefined, '')).toBe('·');
  });

  it('shows the host and a letter on a tint', async () => {
    const box = await mount(LinkTile, { frame: frame({ id: 'u1', kind: 'url', url: 'https://www.vercel.com/', name: 'Pricing' }) });
    const tile = box.querySelector('.link-tile')!;
    expect(tile.className).toMatch(/tint-(sand|sage|clay|slate|lilac|warm)/);
    expect(tile.querySelector('.mono-mark')!.textContent).toBe('V');
    expect(tile.querySelector('.mono-host')!.textContent).toBe('vercel.com');
  });
});

describe('the project grid', () => {
  beforeEach(async () => {
    db.lists = {
      projects: [project('p1', 'Work')],
      frames: [
        frame({ id: 'u1', kind: 'url', url: 'https://vercel.com/', name: 'vercel.com' }),
        frame({ id: 'f1', kind: 'files', name: 'A zip' }),
      ],
    };
    await store.load();
  });

  it('draws a link as a tile, never as a live frame that may come up white, and still frames stored files', async () => {
    const box = await mount(Library, { projectId: 'p1', askUrl: async () => null });
    expect(box.querySelector('[data-card="u1"] .link-tile')).toBeTruthy();
    expect(box.querySelector('[data-card="u1"] iframe')).toBeNull();
    expect(box.querySelector('[data-card="f1"] iframe')).toBeTruthy();
  });
});
