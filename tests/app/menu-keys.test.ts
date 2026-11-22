// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ComponentType } from 'preact';
import { BoardLinks } from '../../src/app/parts';
import { RowMenu } from '../../src/app/move';
import { ProjectMenu } from '../../src/app/ui';
import { clear, click, key, mount } from './helpers/dom';

vi.mock('../../src/app/db', async (orig) => ({ ...(await orig<typeof import('../../src/app/db')>()), getAll: async () => [], put: async () => {} }));
afterEach(() => clear());

const board = (id: string) => ({ id, projectId: 'p1', name: `Board ${id}`, createdAt: 1, updatedAt: 1, arrangement: 'free' as const });

const menus: [string, ComponentType<any>, any, string, number][] = [
  ['the boards menu', BoardLinks, { boards: [board('a'), board('b'), board('c')], label: ['Board', 'Boards'], name: 'Pricing' }, 'button.quiet-link', 3],
  ['the row menu', RowMenu, { ids: ['f1'], name: 'Pricing' }, 'button.more', 2],
  ['the project menu', ProjectMenu as ComponentType<any>, { id: 'p1', name: 'Pricing', pinned: false }, 'button.more', 1],
];

describe.each(menus)('%s', (_n, Comp, props, trigger, count) => {
  const open = async () => {
    const box = await mount(Comp, props);
    const t = box.querySelector<HTMLButtonElement>(trigger)!;
    t.focus();
    await click(t);
    const menu = box.querySelector<HTMLElement>('[role="menu"]')!;
    return { t, menu, items: Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) };
  };

  it('focuses the first item on open', async () => {
    const { items } = await open();
    expect(items).toHaveLength(count);
    expect(document.activeElement).toBe(items[0]);
  });
  it('moves with Up and Down, wrapping, and with Home and End', async () => {
    const { menu, items } = await open();
    const last = items[items.length - 1];
    await key(menu, 'ArrowDown');
    expect(document.activeElement).toBe(items[1 % items.length]);
    await key(menu, 'End');
    expect(document.activeElement).toBe(last);
    await key(menu, 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    await key(menu, 'ArrowUp');
    expect(document.activeElement).toBe(last);
    await key(menu, 'Home');
    expect(document.activeElement).toBe(items[0]);
  });
  it('closes on Escape and returns focus to the trigger', async () => {
    const { t, menu } = await open();
    await key(menu, 'Escape');
    expect(t.isConnected && document.activeElement).toBe(t);
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
