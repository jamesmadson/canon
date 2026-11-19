// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'preact/test-utils';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]>, writes: [] as [string, any][] }));
vi.mock('../../src/app/db', async (orig) => ({
  ...(await orig<typeof import('../../src/app/db')>()),
  getAll: async (name: string) => db.lists[name] ?? [],
  put: async (name: string, value: unknown) => { db.writes.push([name, value]); },
}));

import * as store from '../../src/app/store';
import { ProjectView } from '../../src/app/ui';
import { askProjectName } from '../../src/app/lib/naming';
import { clear, fire, key, mount, project, type } from './helpers/dom';

beforeEach(async () => {
  db.writes = [];
  db.lists = { projects: [project('p1', 'Untitled project'), project('p2', 'Other')], boards: [], placements: [], notes: [], frames: [] };
  await store.load();
});
afterEach(clear);

const view = (id = 'p1') => mount(ProjectView, { id, tab: 'prototypes' as const, askUrl: async () => null });
const nameField = (box: HTMLElement) => box.querySelector<HTMLInputElement>('input[aria-label="Project name"]')!;
const renames = () => db.writes.filter(([n]) => n === 'projects').map(([, v]) => v.name);

describe('a new project asks for its name', () => {
  it('puts the cursor in the name field with Untitled project selected', async () => {
    askProjectName('p1');
    const field = nameField(await view());
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('Untitled project');
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 'Untitled project'.length]);
  });

  it('asks once, and only for the project that was just made', async () => {
    askProjectName('p1');
    const other = nameField(await view('p2'));
    expect(document.activeElement).not.toBe(other);
    clear();
    expect(document.activeElement).not.toBe(nameField(await view('p1')));
  });

  it('saves the typed name on Enter', async () => {
    askProjectName('p1');
    const field = nameField(await view());
    await type(field, 'Checkout');
    await key(field, 'Enter');
    await fire(field, new Event('change', { bubbles: true }));
    expect(renames()).toContain('Checkout');
  });

  it('keeps the default on Escape, even with text typed', async () => {
    askProjectName('p1');
    const field = nameField(await view());
    await type(field, 'Checkout');
    await key(field, 'Escape');
    await fire(field, new Event('change', { bubbles: true }));
    expect(renames()).toEqual([]);
    expect(field.value).toBe('Untitled project');
    expect(field.closest('[role="dialog"]')).toBeNull();
  });
});
