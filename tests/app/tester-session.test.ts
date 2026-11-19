// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAP, SESSION_LIMIT, describeEvent, listEvents, record, resetTester, sessionEvents, sessionFields, setTester } from '../../src/app/lib/tester';
import { FeedbackDialog, TesterPanel } from '../../src/app/feedback';
import { clear, click, mount, type } from './helpers/dom';

beforeEach(() => { localStorage.clear(); resetTester(); });
afterEach(() => { clear(); vi.unstubAllGlobals(); });

const bodyOf = (f: ReturnType<typeof vi.fn>, n = 0) => JSON.parse((f.mock.calls[n] as unknown as [string, RequestInit])[1].body as string);
const bytes = (o: unknown) => new TextEncoder().encode(JSON.stringify(o)).length;

describe('a sent session carries the raw events too', () => {
  it('adds session_json beside the readable lines, with the same events the file holds', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    setTester(true);
    record('star', { on: true });
    record('prototype_open', { kind: 'link', blocked: false, ms: 120, name: 'Secret' });
    const box = await mount(TesterPanel, { onClose: () => {}, returnTo: null, url: 'https://f.test/x' });
    await click(Array.from(box.querySelectorAll('button')).find((b) => b.textContent === 'Send my session')!);
    const body = bodyOf(f);
    expect(body.session).toHaveLength(2);
    expect(typeof body.session_json).toBe('string');
    expect(body.session_json).not.toMatch(/\n|  /);
    const events = JSON.parse(body.session_json);
    expect(events.map((e: { e: string }) => e.e)).toEqual(['star', 'prototype_open']);
    expect(events[1]).toEqual({ t: expect.any(Number), e: 'prototype_open', d: { kind: 'link', blocked: false, ms: 120 } });
    expect(body.session_json).not.toContain('Secret');
    expect(body.session_note).toBeUndefined();
    expect(events).toEqual(sessionEvents(listEvents()));
  });

  it('goes with feedback too, when the person ticks the session box', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    setTester(true);
    record('star', { on: true });
    const box = await mount(FeedbackDialog, { onClose: () => {}, returnTo: null, onSeeList: () => {}, url: 'https://f.test/x' });
    await type(box.querySelector<HTMLTextAreaElement>('#fb-tried') as unknown as HTMLInputElement, 'x');
    await click(box.querySelector('input[type="checkbox"]')!);
    const expected = sessionEvents(listEvents());
    box.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(JSON.parse(bodyOf(f).session_json)).toEqual(expected);
  });

  it('keeps the whole payload under 60 KB by dropping the oldest events from lines and JSON together, and says so', () => {
    setTester(true);
    for (let i = 0; i < CAP; i++) record('search', { length: i, results: i });
    const base = { _subject: 'x', canon_version: '0.1.0' };
    const out = sessionFields(listEvents(), base) as { session: string[]; session_json: string; session_note: string };
    expect(bytes({ ...base, ...out })).toBeLessThan(SESSION_LIMIT);
    const kept = JSON.parse(out.session_json) as { t: number; e: string; d: { length: number } }[];
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(CAP);
    // Newest kept, and the lines describe exactly the same events.
    expect(kept.at(-1)!.d.length).toBe(CAP - 1);
    expect(kept[0].d.length).toBe(CAP - kept.length);
    expect(out.session).toHaveLength(kept.length);
    expect(out.session).toEqual(kept.map((e) => describeEvent(e as never)).reverse());
    expect(out.session_note).toContain(String(CAP - kept.length));
    expect(out.session_note).toMatch(/oldest/);
  });

  it('adds no note when everything fits', () => {
    setTester(true);
    record('star', { on: true });
    expect(sessionFields(listEvents(), {})).not.toHaveProperty('session_note');
  });

  it('the panel says the raw data is included', async () => {
    setTester(true);
    record('star', { on: true });
    const box = await mount(TesterPanel, { onClose: () => {}, returnTo: null, url: 'https://f.test/x' });
    expect(box.textContent).toMatch(/also carries the same events as compact data/);
  });
});
