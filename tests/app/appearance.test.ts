// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';

const db = vi.hoisted(() => ({ lists: {} as Record<string, unknown[]> }));
vi.mock('../../src/app/db', async (orig) => ({ ...(await orig<typeof import('../../src/app/db')>()), getAll: async (n: string) => db.lists[n] ?? [], put: async () => {} }));

import { APPEARANCE_KEY, applyAppearance, chooseAppearance, readAppearance, startAppearance } from '../../src/app/lib/appearance';
import { Settings } from '../../src/app/settings';
import { clear, click, mount, nameOf } from './helpers/dom';

const root = document.documentElement;
let dark = false;
let listeners: (() => void)[] = [];

beforeEach(() => {
  localStorage.clear();
  root.removeAttribute('data-theme');
  document.head.innerHTML = '<meta name="theme-color" content="#151413">';
  dark = false;
  listeners = [];
  window.matchMedia = ((q: string) => ({
    get matches() { return q.includes('dark') && dark; },
    addEventListener: (_: string, fn: () => void) => listeners.push(fn),
    removeEventListener: (_: string, fn: () => void) => { listeners = listeners.filter((l) => l !== fn); },
  })) as unknown as typeof window.matchMedia;
});
afterEach(clear);

const meta = () => document.querySelector('meta[name="theme-color"]')!.getAttribute('content');

describe('appearance', () => {
  it('Light and Dark set the theme and the title bar colour', () => {
    applyAppearance('light');
    expect([root.getAttribute('data-theme'), meta()]).toEqual(['light', '#F7F5F2']);
    applyAppearance('dark');
    expect([root.getAttribute('data-theme'), meta()]).toEqual(['dark', '#151413']);
  });

  it('Match system leaves the theme to the stylesheet and follows the system colour', () => {
    applyAppearance('dark');
    applyAppearance('system');
    expect(root.hasAttribute('data-theme')).toBe(false);
    expect(meta()).toBe('#F7F5F2');
    dark = true;
    applyAppearance('system');
    expect(meta()).toBe('#151413');
  });

  it('is Match system until a choice is made, and the choice survives a reload', () => {
    expect(readAppearance()).toBe('system');
    chooseAppearance('dark');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
    root.removeAttribute('data-theme');
    startAppearance();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('falls back to Match system when storage fails or holds nonsense', () => {
    localStorage.setItem(APPEARANCE_KEY, 'purple');
    expect(readAppearance()).toBe('system');
    const broken = { getItem: () => { throw new Error('blocked'); } };
    expect(readAppearance(broken)).toBe('system');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(() => chooseAppearance('light')).not.toThrow();
    expect(root.getAttribute('data-theme')).toBe('light');
    spy.mockRestore();
  });

  it('Match system reacts live to the system, and Light and Dark ignore it', () => {
    startAppearance();
    dark = true;
    listeners.forEach((l) => l());
    expect(meta()).toBe('#151413');
    dark = false;
    listeners.forEach((l) => l());
    expect(meta()).toBe('#F7F5F2');
    chooseAppearance('light');
    dark = true;
    listeners.forEach((l) => l());
    expect([root.getAttribute('data-theme'), meta()]).toEqual(['light', '#F7F5F2']);
  });
});

describe('the Settings panel', () => {
  it('opens from a Settings button and offers three pill choices, with the saved one pressed', async () => {
    localStorage.setItem(APPEARANCE_KEY, 'light');
    const box = await mount(Settings, {});
    await click(box.querySelector('.settings-btn')!);
    const group = box.querySelector('[role="group"]')!;
    expect(nameOf(group)).toBe('Appearance');
    const buttons = Array.from(group.querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent)).toEqual(['Match system', 'Light', 'Dark']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('applies and keeps a choice', async () => {
    const box = await mount(Settings, {});
    await click(box.querySelector('.settings-btn')!);
    await click(Array.from(box.querySelectorAll('.seg button')).find((b) => b.textContent === 'Dark')!);
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
    await click(Array.from(box.querySelectorAll('.seg button')).find((b) => b.textContent === 'Match system')!);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});

describe('no flash', () => {
  const page = readFileSync('src/pages/app/index.astro', 'utf8');
  const css = readFileSync('src/app/app.css', 'utf8');

  it('sets the theme from an inline script in the head, before the app script and its stylesheet', () => {
    const head = page.slice(page.indexOf('<head>'), page.indexOf('</head>'));
    const at = head.indexOf('<script is:inline>');
    expect(at).toBeGreaterThan(-1);
    expect(head.slice(at)).toContain("localStorage.getItem('canon-appearance')");
    expect(head.slice(at)).toContain("setAttribute('data-theme'");
    expect(page.indexOf("import '../../app/main'")).toBeGreaterThan(page.indexOf('</head>'));
  });

  it('has a stylesheet block for each chosen theme that beats the system one', () => {
    expect(css).toMatch(/:root\[data-theme="light"\]\s*\{[^}]*--bg: #F7F5F2/);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*\{[^}]*--bg: #151413/);
  });
});
