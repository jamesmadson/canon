// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { CAP, CODES, cleanDetails, describeEvent, listEvents, record, resetTester, setTester, stopAndDelete, subscribeTester, testerOn } from '../../src/app/lib/tester';
import { TesterPanel } from '../../src/app/feedback';
import { clear, click, mount, nameOf } from './helpers/dom';

beforeEach(() => { localStorage.clear(); resetTester(); });
afterEach(() => { clear(); vi.unstubAllGlobals(); });

describe('tester mode is off until a person turns it on', () => {
  it('writes nothing while off, not even to storage', () => {
    record('star', { on: true });
    expect(listEvents()).toEqual([]);
    expect(localStorage.getItem('canon-tester-events')).toBeNull();
    expect(testerOn()).toBe(false);
  });
  it('keeps events once on, and remembers the choice after a reload', () => {
    setTester(true);
    record('star', { on: true });
    expect(listEvents()).toHaveLength(1);
    resetTester();
    expect(testerOn()).toBe(true);
    expect(listEvents()).toHaveLength(1);
  });
  it('stop and delete empties the list and turns the mode off', () => {
    setTester(true);
    record('archive', { on: true });
    stopAndDelete();
    expect(testerOn()).toBe(false);
    expect(listEvents()).toEqual([]);
    expect(localStorage.getItem('canon-tester-events')).toBeNull();
  });
});

describe('what may be recorded', () => {
  it('refuses any string that is not a fixed code, so names and links cannot get in', () => {
    const bad = ['Pricing page', 'https://membership-one.webflow.io/', 'localhost:5173', 'notes.html', 'my secret note', 'claude-code'];
    expect(cleanDetails({ name: bad[0], url: bad[1], host: bad[2], file: bad[3], text: bad[4], tag: bad[5] })).toBeUndefined();
    setTester(true);
    for (const s of bad) record('view', { view: s, query: s });
    record('search', { length: 8, results: 3, query: 'pricing' });
    expect(JSON.stringify(listEvents())).not.toMatch(/Pricing|https|localhost|notes\.html|secret|claude-code|pricing/);
    expect(listEvents()[0].d).toEqual({ length: 8, results: 3 });
  });
  it('accepts numbers, booleans and codes only, and ignores odd keys', () => {
    expect(cleanDetails({ ms: 12.6, ok: true, kind: 'link', 'bad key': 1, o: { a: 1 }, n: NaN, arr: [1] })).toEqual({ ms: 13, ok: true, kind: 'link' });
    expect(CODES.has('link')).toBe(true);
  });
  it('ignores an event name it does not know', () => {
    setTester(true);
    record('open_project_named_x' as never, { ms: 1 });
    expect(listEvents()).toEqual([]);
  });
  it('holds the cap and drops the oldest', () => {
    setTester(true);
    for (let i = 0; i < CAP + 50; i++) record('search', { length: i, results: 0 });
    const all = listEvents();
    expect(all).toHaveLength(CAP);
    expect(all[0].d!.length).toBe(CAP + 49);
    expect(all[CAP - 1].d!.length).toBe(50);
  });
});

describe('the readable lines', () => {
  it('say what happened without anything personal', () => {
    const t = new Date(2026, 10, 18, 12, 4, 10).getTime();
    expect(describeEvent({ t, e: 'search', d: { length: 8, results: 3 } })).toBe('12:04:10  Searched, 8 characters, 3 results');
    expect(describeEvent({ t, e: 'app_open', d: { first: false, projects: 1, prototypes: 1 } })).toBe('12:04:10  Opened Canon, returning, 1 project, 1 prototype');
    expect(describeEvent({ t, e: 'prototype_open', d: { kind: 'link', blocked: true } })).toBe('12:04:10  Opened a link prototype, refuses framing');
  });
});

describe('the Help test Canon panel', () => {
  it('explains itself in three lines and has one switch', async () => {
    const box = await mount(TesterPanel, { onClose: () => {}, returnTo: null, url: '' });
    expect(box.querySelectorAll('.tester-says li')).toHaveLength(3);
    const sw = box.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(nameOf(sw)).toBe('Keep a list of what I do');
    expect(sw.checked).toBe(false);
    await click(sw);
    expect(testerOn()).toBe(true);
  });

  it('never sends by itself: not on open, not on a timer, not on close', async () => {
    vi.useFakeTimers();
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    setTester(true);
    record('star', { on: true });
    const onClose = vi.fn();
    const box = await mount(TesterPanel, { onClose, returnTo: null, url: 'https://f.test/x' });
    await act(() => { vi.advanceTimersByTime(10 * 60_000); });
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Close')!);
    expect(onClose).toHaveBeenCalled();
    expect(f).not.toHaveBeenCalled();
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Send my session')!);
    expect(f).toHaveBeenCalledTimes(1);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body._subject).toBe('Canon tester session');
    expect(body.session.join('|')).toMatch(/Starred a prototype/);
    vi.useRealTimers();
  });

  it('by default posts the session to the Formspree form, with fetch mocked', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    setTester(true);
    record('star', { on: true });
    const box = await mount(TesterPanel, { onClose: () => {}, returnTo: null });
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Send my session')!);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('https://formspree.io/f/mdegzjze');
  });

  it('without an address offers a file and Copy instead of Send, listing newest first', async () => {
    setTester(true);
    record('star', { on: true });
    record('archive', { on: true });
    const box = await mount(TesterPanel, { onClose: () => {}, returnTo: null, url: '' });
    const labels = Array.from(box.querySelectorAll('.row button')).map((b) => b.textContent);
    expect(labels).toEqual(['Stop and delete the list', 'Download as a file', 'Copy', 'Close']);
    expect(box.querySelectorAll('.session-list li')[0].textContent).toMatch(/Archived a prototype/);
  });
});

describe('two tabs sharing one storage', () => {
  it('does not write an old list back after another tab stopped and deleted', () => {
    setTester(true);
    record('star', { on: true });
    // Another tab pressed "Stop and delete the list": storage changes, this tab hears nothing.
    localStorage.setItem('canon-tester-on', 'false');
    localStorage.removeItem('canon-tester-events');
    record('archive', { on: true });
    expect(localStorage.getItem('canon-tester-events')).toBeNull();
  });
  it('keeps events another tab recorded', () => {
    setTester(true);
    record('star', { on: true });
    const stored = JSON.parse(localStorage.getItem('canon-tester-events')!);
    localStorage.setItem('canon-tester-events', JSON.stringify([...stored, { t: 5, e: 'search', d: { length: 3 } }]));
    record('archive', { on: true });
    expect(JSON.parse(localStorage.getItem('canon-tester-events')!).map((x: { e: string }) => x.e)).toEqual(['star', 'search', 'archive']);
  });
  it('follows a storage event: off and empty when deleted elsewhere', () => {
    setTester(true);
    record('star', { on: true });
    const seen = vi.fn();
    subscribeTester(seen);
    localStorage.setItem('canon-tester-on', 'false');
    localStorage.removeItem('canon-tester-events');
    window.dispatchEvent(new StorageEvent('storage', { key: 'canon-tester-on' }));
    expect(testerOn()).toBe(false);
    expect(listEvents()).toEqual([]);
    expect(seen).toHaveBeenCalled();
  });
  it('runs stored events through the allowlist when loading', () => {
    localStorage.setItem('canon-tester-on', 'true');
    localStorage.setItem('canon-tester-events', JSON.stringify([{ t: 1, e: 'view', d: { view: 'home', name: 'secret', free: 'my private text', length: 4 } }]));
    expect(listEvents()[0].d).toEqual({ view: 'home', length: 4 });
  });
});
