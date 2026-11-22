// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Composer, CommentsPanel, Pin, Thread } from '../../src/app/comments';
import { NoteItem } from '../../src/app/shared';
import type { Note } from '../../src/app/db';
import { clear, mount } from './helpers/dom';

vi.mock('../../src/app/db', async (orig) => ({ ...(await orig<typeof import('../../src/app/db')>()), getAll: async () => [], put: async () => {} }));
afterEach(() => clear());

const note = (p: Partial<Note> = {}): Note => ({ id: 'n1', frameId: 'f1', kind: 'comment', author: 'Jo Mills', said: 'Tighten this', createdAt: 1, ...p } as Note);
const label = (el: Element | null) => el?.getAttribute('aria-label');

describe('note pins', () => {
  it('start with the initials they show, then say who wrote it', async () => {
    const box = await mount(Pin, { n: 3, note: note(), left: 0, top: 0, onOpen: () => {} });
    const button = box.querySelector('button')!;
    expect(label(button)).toBe('JM, note 3 by Jo Mills');
    expect(label(button)!.startsWith(button.firstChild!.textContent!)).toBe(true);
  });
  it('say when a note is resolved', async () => {
    const box = await mount(Pin, { n: 3, note: note({ resolved: true }), left: 0, top: 0, onOpen: () => {} });
    expect(label(box.querySelector('button'))).toBe('JM, note 3 by Jo Mills, resolved');
  });
  it('name a numbered note by its number', async () => {
    const box = await mount(Pin, { n: 3, note: note({ kind: 'note', author: undefined }), left: 0, top: 0, onOpen: () => {} });
    expect(label(box.querySelector('button'))).toMatch(/^Note 3/);
  });
});

describe('the note thread', () => {
  it('names its icon buttons and the reply box', async () => {
    const box = await mount(Thread, { note: note(), sx: 0, sy: 0, onClose: () => {} });
    const icons = Array.from(box.querySelectorAll('button.icon'));
    expect(icons.map(label)).toEqual(['Resolve', 'Delete thread', 'Close']);
    expect(label(box.querySelector('input.field'))).toBe('Reply to this note');
  });
  it('says Reopen on a resolved thread', async () => {
    const box = await mount(Thread, { note: note({ resolved: true }), sx: 0, sy: 0, onClose: () => {} });
    expect(label(box.querySelector('button.icon'))).toBe('Reopen');
  });
});

describe('the composer', () => {
  it('names the note box and the name field', async () => {
    localStorage.clear();
    const box = await mount(Composer, { at: { sx: 0, sy: 0 } as any, onCancel: () => {}, onSave: () => {} });
    expect(label(box.querySelector('textarea'))).toBe('Add a note');
    expect(label(box.querySelector('.name-ask input'))).toBe('Your name');
  });
});

describe('the notes panel and a note in a list', () => {
  it('names the panel close button', async () => {
    const box = await mount(CommentsPanel, { notes: [], onPick: () => {}, onClose: () => {} });
    expect(label(box.querySelector('button.icon'))).toBe('Close notes');
  });
  it('names the delete button on a note', async () => {
    const box = await mount(NoteItem, { note: note() });
    expect(label(box.querySelector('.foot button'))).toBe('Delete note');
  });
});

describe('the board screen', () => {
  const canvas = readFileSync('src/app/canvas.ts', 'utf8');
  it('names the find field, the notes button, the prototype name and the library search', () => {
    expect(canvas).toMatch(/<input aria-label="Find on board"/);
    expect(canvas).toMatch(/title="Notes" aria-label=\$\{`Notes, \$\{openCount\} open`\}/);
    expect(canvas).toMatch(/class="insp-name" aria-label="Prototype name"/);
    expect(canvas).toMatch(/aria-label="Search prototypes"/);
  });
});
