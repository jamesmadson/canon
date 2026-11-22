// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from 'preact';
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
afterEach(() => clear());

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
