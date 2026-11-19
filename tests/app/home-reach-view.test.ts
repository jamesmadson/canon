// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { HomeBody, type HomeBodyProps } from '../../src/app/home';
import { resetLive } from '../../src/app/live';
import { cardsOf, scopeCards, tagCounts } from '../../src/app/lib/home';
import { clear, frame, mount, project } from './helpers/dom';

const asked: string[] = [];

beforeEach(() => {
  resetLive();
  asked.length = 0;
  // Every local server is off: both asks of the probe fail.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => { asked.push(url); throw new TypeError('refused'); }));
});
afterEach(() => { clear(); vi.unstubAllGlobals(); });

const props = (view: 'list' | 'shelf'): HomeBodyProps => {
  const frames = [
    frame({ id: 'off', name: 'Local one', kind: 'url', url: 'http://localhost:5173/', entry: undefined }),
    frame({ id: 'off2', name: 'Local two', kind: 'url', url: 'http://localhost:5173/two', entry: undefined }),
    frame({ id: 'blocked', name: 'Blocked site', kind: 'url', url: 'https://example.com/', frameBlocked: true, entry: undefined }),
    frame({ id: 'remote', name: 'Remote site', kind: 'url', url: 'https://example.org/', entry: undefined }),
    frame({ id: 'copy', name: 'Stored copy', kind: 'files', liveUrl: 'http://localhost:9999/' }),
  ];
  const cards = scopeCards(cardsOf(frames), { kind: 'home' });
  return {
    scope: { kind: 'home' }, cards, projects: [project('p1', 'One')], view, onView: () => {}, chosenTags: [], onTags: () => {}, tagList: tagCounts(cards),
    onOpen: () => {}, onWay: () => {}, arriving: null, landed: null,
  };
};

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe.each(['list', 'shelf'] as const)('Home %s', (view) => {
  it('marks a local link whose server is off, and a page that refuses framing', async () => {
    const box = await mount(HomeBody, props(view));
    await settle();
    const card = (id: string) => box.querySelector(`[data-card="${id}"]`)!;
    expect(card('off').textContent).toContain('Server off');
    expect(card('off2').textContent).toContain('Server off');
    expect(card('blocked').textContent).toContain('Opens in a new tab');
    expect(card('remote').textContent).not.toMatch(/Server off|Opens in a new tab/);
    expect(card('copy').textContent).not.toMatch(/Server off|Opens in a new tab/);
  });

  it('asks only this machine, once per host and port', async () => {
    await mount(HomeBody, props(view));
    await settle();
    expect(asked.length).toBeGreaterThan(0);
    for (const u of asked) expect(u).toMatch(/^http:\/\/localhost:5173\//);
    // Two asks per dead host at most (the probe retries once); one host, so no more than two.
    expect(asked.length).toBeLessThanOrEqual(2);
  });
});
