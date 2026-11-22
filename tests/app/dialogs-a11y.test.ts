// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { Modal } from '../../src/app/feedback';
import { LibraryPicker } from '../../src/app/canvas';
import { PairDialog, UrlDialog } from '../../src/app/ui';
import { clear, key, mount } from './helpers/dom';

vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async () => [],
  put: async () => {},
}));

const closed = vi.fn();
let opener: HTMLButtonElement;
beforeEach(() => {
  closed.mockClear();
  opener = document.createElement('button');
  opener.textContent = 'Open';
  document.body.appendChild(opener);
  opener.focus();
});
// Unmount first, so a dialog's window listener does not outlive its test.
afterEach(() => { document.body.querySelectorAll(':scope > div').forEach((b) => render(null, b)); clear(); });

const secret = 'ab'.repeat(32);
const dialogs: [string, () => Promise<HTMLElement>][] = [
  ['the library picker', () => mount(LibraryPicker, { projectId: 'p1', boardId: 'b1', onClose: closed })],
  ['the pairing dialog', () => mount(PairDialog, { pair: { agentId: 'a.1', name: 'Agent', port: 1, secret } as any, onClose: closed })],
  ['the link dialog', () => mount(UrlDialog, { onClose: closed })],
];

describe.each(dialogs)('%s', (_name, open) => {
  it('is a labelled modal dialog', async () => {
    const box = await open();
    const d = box.querySelector('[role="dialog"]')!;
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(document.getElementById(d.getAttribute('aria-labelledby')!)?.textContent?.length).toBeGreaterThan(0);
  });
  it('closes on Escape', async () => {
    const box = await open();
    await key(box.querySelector('[role="dialog"]')!, 'Escape');
    expect(closed).toHaveBeenCalled();
  });
  it('keeps Tab inside', async () => {
    const box = await open();
    const d = box.querySelector('[role="dialog"]')!;
    const items = Array.from(d.querySelectorAll<HTMLElement>('input, button'));
    items[items.length - 1].focus();
    await key(d, 'Tab');
    expect(document.activeElement).toBe(items[0]);
    await key(d, 'Tab', { shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });
  it('gives focus back to the opener when it goes away', async () => {
    const box = await open();
    expect(document.activeElement).not.toBe(opener);
    render(null, box);
    expect(document.activeElement).toBe(opener);
  });
});

describe('a dialog after focus falls to the page', () => {
  const Removable = ({ onClose, gone }: { onClose: () => void; gone: boolean }) =>
    h(Modal, { id: 'rm', title: 'Pick', onClose, children: [gone ? null : h('button', { id: 'row' }, 'Row'), h('button', { id: 'done' }, 'Done')] });

  it('still closes on Escape and stops it reaching the page', async () => {
    const seen = vi.fn();
    document.addEventListener('keydown', seen);
    const box = await mount(Removable, { onClose: closed, gone: false });
    (box.querySelector('#row') as HTMLElement).focus();
    await act(() => { render(h(Removable, { onClose: closed, gone: true }), box); });
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    await key(document.body, 'Escape');
    expect(closed).toHaveBeenCalledTimes(1);
    expect(seen).not.toHaveBeenCalled();
    document.removeEventListener('keydown', seen);
  });
  it('pulls Tab and Shift+Tab back inside', async () => {
    const box = await mount(Removable, { onClose: closed, gone: true });
    (document.activeElement as HTMLElement).blur();
    await key(document.body, 'Tab');
    expect(document.activeElement).toBe(box.querySelector('#done'));
    (document.activeElement as HTMLElement).blur();
    await key(document.body, 'Tab', { shiftKey: true });
    expect(box.contains(document.activeElement)).toBe(true);
  });
  it('closes the link dialog once on Escape', async () => {
    const box = await mount(UrlDialog, { onClose: closed });
    await key(box.querySelector('input')!, 'Escape');
    expect(closed).toHaveBeenCalledTimes(1);
  });
  it('holds focus on the dialog when nothing in it can take focus', async () => {
    const Empty = () => h(Modal, { id: 'e', title: 'Empty', onClose: closed, children: null });
    const box = await mount(Empty, {});
    const d = box.querySelector<HTMLElement>('[role="dialog"]')!;
    await key(document.body, 'Tab');
    expect(document.activeElement).toBe(d);
  });
});
