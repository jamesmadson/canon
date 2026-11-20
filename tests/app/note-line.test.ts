// @vitest-environment jsdom
import type { ComponentType } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ tables: {} as Record<string, any[]> }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (n: string) => structuredClone(db.tables[n] ?? []),
  put: async () => {},
  remove: async () => {},
}));

import * as store from '../../src/app/store';
import { ProtoRow, ShelfCard } from '../../src/app/parts';
import { cardOf, noteLine } from '../../src/app/lib/home';
import { App } from '../../src/app/ui';
import { clear, frame, mount, project } from './helpers/dom';

describe('noteLine', () => {
  it('is the first line of the note, trimmed', () => {
    expect(noteLine('  Check the tiers\nthen the footer ')).toBe('Check the tiers');
    expect(noteLine('\n\nSecond paragraph first')).toBe('Second paragraph first');
    expect(noteLine('')).toBe('');
    expect(noteLine(undefined)).toBe('');
  });
});

describe('a note on a row and a card', () => {
  afterEach(clear);
  const withNote = cardOf(frame({ id: 'a', name: 'Pricing', note: 'Check the tiers\nand the footer' }));
  const without = cardOf(frame({ id: 'b', name: 'Plain' }));

  it('shows its first line on the row, once', async () => {
    const box = await mount(ProtoRow, { card: withNote, onOpen: () => {} });
    const line = box.querySelector('.pn')!;
    expect(line.textContent).toBe('Check the tiers');
    expect(line.getAttribute('title')).toBe('Check the tiers\nand the footer');
    expect(box.textContent).not.toContain('and the footer');
  });

  it('shows its first line on the card', async () => {
    const box = await mount(ShelfCard, { card: withNote, onOpen: () => {} });
    expect(box.querySelector('.cnote')!.textContent).toBe('Check the tiers');
  });

  it('shows nothing when there is no note', async () => {
    expect((await mount(ProtoRow, { card: without, onOpen: () => {} })).querySelector('.pn')).toBeNull();
    expect((await mount(ShelfCard, { card: without, onOpen: () => {} })).querySelector('.cnote')).toBeNull();
  });
});

describe('the project Notes tab with no boards', () => {
  beforeEach(async () => {
    db.tables = { projects: [project('p1', 'Pricing')], boards: [], frames: [], placements: [], notes: [], agents: [] };
    await store.load();
    history.replaceState(null, '', '#/p/p1/comments');
  });
  afterEach(clear);

  it('does not point at boards', async () => {
    const box = await mount(App as ComponentType<any>, {});
    const empty = box.querySelector('.record .empty')!;
    expect(empty.textContent).toBe('Nothing open yet.');
  });

  it('keeps the board hint when the project has a board', async () => {
    db.tables.boards = [{ id: 'b1', projectId: 'p1', name: 'Board', createdAt: 1, updatedAt: 1, arrangement: 'free' }];
    await store.load();
    const box = await mount(App as ComponentType<any>, {});
    expect(box.querySelector('.record .empty')!.textContent).toBe('Nothing open. Press N on a board and click anywhere.');
  });
});
