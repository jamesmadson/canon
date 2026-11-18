// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { FeedbackDialog } from '../../src/app/feedback';
import { FEEDBACK_URL, ISSUES_URL, failureMessage, issueUrl, payloadOf, postJson } from '../../src/app/lib/feedback';
import { resetTester, setTester, record } from '../../src/app/lib/tester';
import { clear, click, key, mount, nameOf, type } from './helpers/dom';

beforeEach(() => { localStorage.clear(); resetTester(); });
afterEach(() => { clear(); vi.unstubAllGlobals(); });

const field = (box: HTMLElement, label: string) => Array.from(box.querySelectorAll<HTMLInputElement>('input, textarea')).find((e) => nameOf(e) === label)!;
const submit = (box: HTMLElement) => act(() => { box.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

describe('the feedback address', () => {
  it('is empty until the owner supplies one', () => expect(FEEDBACK_URL).toBe(''));
});

describe('the GitHub issue fallback', () => {
  it('prefills the title and body, leaves the email out, and stays under 6000 characters', () => {
    const url = issueUrl({ tried: 'Open a link\nsecond line', happened: 'x'.repeat(20000), email: 'me@example.com' });
    expect(url.startsWith(`${ISSUES_URL}?title=Open%20a%20link&body=`)).toBe(true);
    expect(url.length).toBeLessThan(6000);
    expect(decodeURIComponent(url)).not.toContain('me@example.com');
    expect(decodeURIComponent(url)).toContain('What were you trying to do?');
  });
});

describe('posting feedback', () => {
  const answer = (status: number) => vi.fn(async () => new Response('{}', { status }));
  it('sends JSON with an accept header, a subject and an empty honeypot', async () => {
    const f = answer(200);
    expect(await postJson('https://f.test/x', payloadOf({ tried: ' a ', happened: '', email: '' }), f as unknown as typeof fetch)).toEqual({ ok: true });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
    expect(JSON.parse(init.body as string)).toMatchObject({ _subject: 'Canon feedback', _gotcha: '', tried: 'a' });
  });
  it('tells success, a refusal, a rate limit, a server fault and no network apart', async () => {
    expect(await postJson('u', {}, answer(422) as unknown as typeof fetch)).toMatchObject({ ok: false, reason: 'refused', status: 422 });
    expect(await postJson('u', {}, answer(429) as unknown as typeof fetch)).toMatchObject({ ok: false, reason: 'rate' });
    expect(await postJson('u', {}, answer(503) as unknown as typeof fetch)).toMatchObject({ ok: false, reason: 'server' });
    const down = vi.fn(async () => { throw new TypeError('offline'); });
    const r = await postJson('u', {}, down as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, reason: 'network' });
    for (const x of [r, { ok: false as const, reason: 'rate' as const }]) expect(failureMessage(x)).toContain('still here');
  });
});

describe('the feedback dialog', () => {
  it('has labelled fields, dialog semantics, and the plain line about what is sent', async () => {
    const box = await mount(FeedbackDialog, { onClose: () => {}, returnTo: null, onSeeList: () => {}, url: 'https://f.test/x' });
    const d = box.querySelector('[role="dialog"]')!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(nameOf(d)).toBe('Send feedback');
    for (const l of ['What were you trying to do?', 'What happened?', 'Email, if you want a reply']) expect(field(box, l)).toBeTruthy();
    expect(box.textContent).toContain("This sends only what you typed here, plus Canon's version.");
    expect(box.textContent).not.toContain('Include my session list');
  });

  it('will not send without the first answer, and says why', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const box = await mount(FeedbackDialog, { onClose: () => {}, returnTo: null, onSeeList: () => {}, url: 'https://f.test/x' });
    await submit(box);
    expect(f).not.toHaveBeenCalled();
    expect(box.querySelector('[role="alert"]')!.textContent).toMatch(/Say what you were trying/);
  });

  it('keeps what was typed when sending fails, and closes when it works', async () => {
    const onClose = vi.fn();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const box = await mount(FeedbackDialog, { onClose, returnTo: null, onSeeList: () => {}, url: 'https://f.test/x' });
    await type(field(box, 'What were you trying to do?'), 'Add a link');
    await submit(box);
    await settle();
    expect(box.querySelector('[role="alert"]')!.textContent).toMatch(/could not reach/);
    expect(field(box, 'What were you trying to do?').value).toBe('Add a link');
    expect(onClose).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
    await submit(box);
    await settle();
    expect(onClose).toHaveBeenCalled();
  });

  it('with no address, opens a GitHub issue in a new tab and says that issues are public', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const box = await mount(FeedbackDialog, { onClose: () => {}, returnTo: null, onSeeList: () => {}, url: '' });
    expect(box.querySelector('button[type="submit"]')!.textContent).toBe('Open a GitHub issue');
    expect(box.textContent).toContain('Issues there are public');
    await type(field(box, 'What were you trying to do?'), 'Add a link');
    await submit(box);
    expect(open).toHaveBeenCalledTimes(1);
    expect((open.mock.calls[0][0] as string).startsWith(ISSUES_URL)).toBe(true);
    expect(open.mock.calls[0][1]).toBe('_blank');
  });

  it('offers the session list only in tester mode, and sends it only when ticked', async () => {
    setTester(true);
    record('star', { on: true });
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    const box = await mount(FeedbackDialog, { onClose: () => {}, returnTo: null, onSeeList: () => {}, url: 'https://f.test/x' });
    expect(box.textContent).toContain('See what is in it');
    await type(field(box, 'What were you trying to do?'), 'x');
    await submit(box);
    await settle();
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).session).toBeUndefined();
    await click(field(box, 'Include my session list'));
    await submit(box);
    await settle();
    expect(JSON.parse((f.mock.calls[1] as unknown as [string, RequestInit])[1].body as string).session.join('|')).toContain('Starred a prototype');
  });

  it('closes on Escape and keeps Tab inside', async () => {
    const onClose = vi.fn();
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const box = await mount(FeedbackDialog, { onClose, returnTo: outside, onSeeList: () => {}, url: 'https://f.test/x' });
    const buttons = box.querySelectorAll('button');
    const last = buttons[buttons.length - 1];
    last.focus();
    await key(last, 'Tab');
    expect(box.contains(document.activeElement)).toBe(true);
    await key(last, 'Escape');
    expect(onClose).toHaveBeenCalled();
  });
});
