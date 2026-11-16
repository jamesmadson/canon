// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { FrameBody, LiveSwitch, isLive, resetLive } from '../../src/app/live';
import { clear, click, frame, mount, nameOf, unnamed } from './helpers/dom';

const up = () => vi.fn(async () => ({ type: 'opaque' }) as unknown as Response);
const down = () => vi.fn(async () => { throw new TypeError('Failed to fetch'); });

async function settle() {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

const stored = (over = {}) => frame({ id: 's1', name: 'Cart', kind: 'files', liveUrl: 'http://localhost:5173/', ...over });
const link = (url: string) => frame({ id: 'l1', name: 'Pricing', kind: 'url', url, entry: undefined });

beforeEach(() => resetLive());
afterEach(() => { clear(); vi.unstubAllGlobals(); });

describe('the Live switch', () => {
  it('is not there for a prototype with no live address, and does not ask anything', async () => {
    const f = up();
    vi.stubGlobal('fetch', f);
    const box = await mount(LiveSwitch, { frame: frame({ id: 'x', kind: 'files' }) });
    await settle();
    expect(box.querySelector('button')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('is not there while the check runs, or when the server does not answer', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const waiting = await mount(LiveSwitch, { frame: stored() });
    await settle();
    expect(waiting.querySelector('button')).toBeNull();
    clear();
    resetLive();
    vi.stubGlobal('fetch', down());
    const off = await mount(LiveSwitch, { frame: stored() });
    await settle();
    expect(off.querySelector('button')).toBeNull();
  });

  it('shows a labelled, unpressed switch when the server answers, and nothing is stored', async () => {
    const f = up();
    vi.stubGlobal('fetch', f);
    const box = await mount(LiveSwitch, { frame: stored() });
    await settle();
    const b = box.querySelector('button')!;
    expect(nameOf(b)).toBe('Live');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(unnamed(box)).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(isLive('s1')).toBe(false);
  });

  it('switches on and back off, and only for this session', async () => {
    vi.stubGlobal('fetch', up());
    const box = await mount(LiveSwitch, { frame: stored() });
    await settle();
    await click(box.querySelector('button')!);
    expect(box.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
    expect(isLive('s1')).toBe(true);
    await click(box.querySelector('button')!);
    expect(box.querySelector('button')!.getAttribute('aria-pressed')).toBe('false');
    expect(isLive('s1')).toBe(false);
    // Nothing was written anywhere the next session could read.
    expect(JSON.stringify({ ...localStorage })).toBe('{}');
    resetLive();
    expect(isLive('s1')).toBe(false);
  });

  it('stays while Live is on, even if the server stops, so it can be switched off', async () => {
    vi.stubGlobal('fetch', up());
    const box = await mount(LiveSwitch, { frame: stored() });
    await settle();
    await click(box.querySelector('button')!);
    clear();
    vi.stubGlobal('fetch', down());
    const again = await mount(LiveSwitch, { frame: stored() });
    await settle();
    expect(again.querySelector('button')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('is offered for a live address that is not on this machine, without asking it anything', async () => {
    const f = up();
    vi.stubGlobal('fetch', f);
    const box = await mount(LiveSwitch, { frame: stored({ liveUrl: 'https://preview.example.com/' }) });
    await settle();
    expect(nameOf(box.querySelector('button')!)).toBe('Live');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('what a frame shows', () => {
  const srcOf = (box: HTMLElement) => box.querySelector('iframe')?.getAttribute('src');

  it('a stored copy shows its stored files by default and does not ask the server', async () => {
    const f = up();
    vi.stubGlobal('fetch', f);
    const box = await mount(FrameBody, { frame: stored() });
    await settle();
    expect(srcOf(box)).toMatch(/app\/p\/s1\/index\.html/);
    expect(f).not.toHaveBeenCalled();
  });

  it('a stored copy shows the live address while Live is on', async () => {
    vi.stubGlobal('fetch', up());
    const sw = await mount(LiveSwitch, { frame: stored() });
    const body = await mount(FrameBody, { frame: stored() });
    await settle();
    expect(srcOf(body)).toMatch(/app\/p\/s1/);
    await click(sw.querySelector('button')!);
    expect(srcOf(body)).toBe('http://localhost:5173/');
    await click(sw.querySelector('button')!);
    expect(srcOf(body)).toMatch(/app\/p\/s1/);
  });

  it('a link to a localhost server that is not running says so, in place of the frame', async () => {
    vi.stubGlobal('fetch', down());
    const box = await mount(FrameBody, { frame: link('http://localhost:5173/') });
    await settle();
    expect(box.querySelector('iframe')).toBeNull();
    expect(box.textContent).toBe('The server at localhost:5173 is not running. Start it, or ask your agent to add a built copy.');
    expect(box.querySelector('[role="status"]')).not.toBeNull();
  });

  it('a link to a localhost server that answers shows the frame', async () => {
    vi.stubGlobal('fetch', up());
    const box = await mount(FrameBody, { frame: link('http://127.0.0.1:3000/app') });
    await settle();
    expect(srcOf(box)).toBe('http://127.0.0.1:3000/app');
  });

  it('waits, with no frame and no message, while the check runs', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const box = await mount(FrameBody, { frame: link('http://localhost:5173/') });
    await settle();
    expect(box.querySelector('iframe')).toBeNull();
    expect(box.textContent).toBe('');
  });

  it('a link that is not on this machine behaves as before and asks nothing', async () => {
    const f = down();
    vi.stubGlobal('fetch', f);
    const box = await mount(FrameBody, { frame: link('https://proto.example.com/x') });
    await settle();
    expect(srcOf(box)).toBe('https://proto.example.com/x');
    expect(f).not.toHaveBeenCalled();
  });

  it('while Live is on and the server stops, the message replaces the frame', async () => {
    vi.stubGlobal('fetch', up());
    const sw = await mount(LiveSwitch, { frame: stored() });
    await settle();
    await click(sw.querySelector('button')!);
    clear();
    resetLive(false);
    vi.stubGlobal('fetch', down());
    const body = await mount(FrameBody, { frame: stored() });
    await settle();
    expect(body.querySelector('iframe')).toBeNull();
    expect(body.textContent).toContain('The server at localhost:5173 is not running.');
  });
});
