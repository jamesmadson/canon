import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ lists: {} as Record<string, any[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async () => {},
}));

import * as store from '../../src/app/store';
import { framingTip, refusesFraming } from '../../src/app/lib/framing';
import { project } from './helpers/dom';

describe('refusesFraming', () => {
  it('knows the hosts that refuse and their subdomains', () => {
    for (const u of ['https://v0.app/chat/x', 'https://v0.dev/', 'https://lovable.dev/p', 'https://www.figma.com/proto/abc', 'https://my-app.lovable.dev/', 'https://FIGMA.com/'])
      expect(refusesFraming(u), u).toBe(true);
  });
  it('knows the editors and chat tools verified to refuse', () => {
    for (const u of ['https://bolt.new/~/x', 'https://framer.com/projects/a', 'https://replit.com/@a/b', 'https://stackblitz.com/edit/x', 'https://claude.ai/chat/1', 'https://chatgpt.com/c/1', 'https://www.notion.so/page', 'https://app.v0.dev/'])
      expect(refusesFraming(u), u).toBe(true);
  });
  it('leaves published-site hosts alone', () => {
    for (const u of ['https://a.vercel.app/', 'https://a.netlify.app/', 'https://a.lovable.app/', 'https://a.figma.site/', 'https://a.framer.website/', 'https://a.github.io/'])
      expect(refusesFraming(u), u).toBe(false);
  });
  it('leaves other hosts alone, including look-alikes', () => {
    for (const u of ['https://example.com/', 'https://notfigma.com/', 'https://figma.com.evil.test/', 'https://v0.app.example/', 'not a url', ''])
      expect(refusesFraming(u), u).toBe(false);
  });
});

describe('framingTip', () => {
  const tip = (u: string) => framingTip(u).replace(/\u00a0/g, ' ');
  it('names the tool and what to add', () => {
    expect(tip('https://v0.app/chat/x')).toBe('This is v0’s editor. Publish it and add the vercel.app link to see it here.');
    expect(tip('https://v0.dev/')).toBe(tip('https://v0.app/'));
    expect(tip('https://lovable.dev/p')).toBe('This is Lovable’s editor. Publish it and add the lovable.app link to see it here.');
    expect(tip('https://bolt.new/')).toBe('This is Bolt’s editor. Deploy it and add the published link to see it here.');
    expect(tip('https://www.figma.com/make/x')).toBe('This is a Figma file. Publish your Make and add the published link to see it here.');
    expect(tip('https://framer.com/x')).toBe('This is Framer’s editor. Publish it and add the site link to see it here.');
    expect(tip('https://replit.com/@a')).toBe('This is an editor. Add the running app’s link to see it here.');
    expect(tip('https://stackblitz.com/edit/x')).toBe(tip('https://replit.com/@a'));
  });
  it('falls back to adding a build folder or zip', () => {
    for (const u of ['https://claude.ai/chat/1', 'https://x.webflow.io/', 'nope'])
      expect(tip(u)).toBe('To see it here, add a build folder or a zip as another version.');
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
