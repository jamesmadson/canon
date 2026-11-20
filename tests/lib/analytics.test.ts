// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHOICE_KEY, initAnalytics } from '../../src/lib/analytics';

const ID = 'G-F4MW70DVD4';
const SRC = `https://www.googletagmanager.com/gtag/js?id=${ID}`;

function page() {
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <div class="ga-bar" data-ga-bar data-ga-id="${ID}" data-ga-src="${SRC}" hidden>
      <button data-ga-allow>Allow</button><button data-ga-deny>No thanks</button>
    </div>
    <div data-ga-footer hidden><button data-ga-open>Cookie choice</button></div>`;
}
const bar = () => document.querySelector<HTMLElement>('[data-ga-bar]')!;
const calls = () => ((window as any).dataLayer ?? []).map((a: ArrayLike<unknown>) => Array.from(a));
const loaders = () => document.head.querySelectorAll(`script[src="${SRC}"]`).length;

beforeEach(() => {
  vi.useFakeTimers();
  page();
  localStorage.clear();
  delete (window as any).dataLayer;
  delete (window as any).gtag;
  delete (navigator as any).globalPrivacyControl;
});
afterEach(() => vi.useRealTimers());

describe('the consent bar and gtag', () => {
  it('sets every consent default to denied before config, and loads the script', () => {
    initAnalytics({ doc: document, win: window, enabled: true });
    const c = calls();
    expect(c[0]).toEqual(['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    const configAt = c.findIndex((x: unknown[]) => x[0] === 'config');
    expect(configAt).toBeGreaterThan(0);
    expect(c[configAt]).toEqual(['config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false }]);
    expect(loaders()).toBe(1);
  });

  it('fades the bar in after 600ms and shows the footer controls', () => {
    initAnalytics({ doc: document, win: window, enabled: true });
    expect(bar().hidden).toBe(true);
    vi.advanceTimersByTime(599);
    expect(bar().hidden).toBe(true);
    vi.advanceTimersByTime(1);
    expect(bar().hidden).toBe(false);
    expect(bar().classList.contains('is-on')).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-ga-footer]')!.hidden).toBe(false);
  });

  it('Allow grants analytics storage only, remembers it and hides the bar', () => {
    initAnalytics({ doc: document, win: window, enabled: true });
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLElement>('[data-ga-allow]')!.click();
    expect(calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    expect(JSON.stringify(calls())).not.toMatch(/ad_storage['"]?:\s*['"]granted|ad_user_data['"]?:\s*['"]granted|ad_personalization['"]?:\s*['"]granted/);
    expect(localStorage.getItem(CHOICE_KEY)).toBe('allow');
    vi.advanceTimersByTime(400);
    expect(bar().hidden).toBe(true);
  });

  it('No thanks stores the choice and hides the bar', () => {
    initAnalytics({ doc: document, win: window, enabled: true });
    vi.advanceTimersByTime(600);
    document.querySelector<HTMLElement>('[data-ga-deny]')!.click();
    expect(localStorage.getItem(CHOICE_KEY)).toBe('deny');
    expect(calls().at(-1)).toEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    vi.advanceTimersByTime(400);
    expect(bar().hidden).toBe(true);
  });

  it('a stored allow grants at start and shows no bar', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    initAnalytics({ doc: document, win: window, enabled: true });
    expect(calls()[0][1]).toBe('default');
    expect(calls()[1]).toEqual(['consent', 'update', { analytics_storage: 'granted' }]);
    vi.advanceTimersByTime(2000);
    expect(bar().hidden).toBe(true);
  });

  it('a stored no loads nothing and shows no bar', () => {
    localStorage.setItem(CHOICE_KEY, 'deny');
    initAnalytics({ doc: document, win: window, enabled: true });
    vi.advanceTimersByTime(2000);
    expect(loaders()).toBe(0);
    expect(bar().hidden).toBe(true);
  });

  it('treats Global Privacy Control as no thanks: no bar, no script', () => {
    (navigator as any).globalPrivacyControl = true;
    initAnalytics({ doc: document, win: window, enabled: true });
    vi.advanceTimersByTime(2000);
    expect(loaders()).toBe(0);
    expect(bar().hidden).toBe(true);
  });

  it('Cookie choice reopens the bar at once, and a late Allow loads the script', () => {
    localStorage.setItem(CHOICE_KEY, 'deny');
    initAnalytics({ doc: document, win: window, enabled: true });
    document.querySelector<HTMLElement>('[data-ga-open]')!.click();
    expect(bar().hidden).toBe(false);
    document.querySelector<HTMLElement>('[data-ga-allow]')!.click();
    expect(loaders()).toBe(1);
    expect(localStorage.getItem(CHOICE_KEY)).toBe('allow');
  });

  it('a first-visit choice leaves focus and scroll where they were', () => {
    initAnalytics({ doc: document, win: window, enabled: true });
    vi.advanceTimersByTime(600);
    const footerButton = document.querySelector<HTMLElement>('[data-ga-open]')!;
    const focus = vi.spyOn(footerButton, 'focus');
    document.querySelector<HTMLElement>('[data-ga-allow]')!.click();
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(footerButton);
  });

  it('a choice made from the reopened bar returns focus to its button without scrolling', () => {
    localStorage.setItem(CHOICE_KEY, 'deny');
    initAnalytics({ doc: document, win: window, enabled: true });
    const footerButton = document.querySelector<HTMLElement>('[data-ga-open]')!;
    const focus = vi.spyOn(footerButton, 'focus');
    footerButton.click();
    document.querySelector<HTMLElement>('[data-ga-deny]')!.click();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('does nothing when disabled, as in the dev server', () => {
    expect(initAnalytics({ doc: document, win: window, enabled: false })).toBeNull();
    vi.advanceTimersByTime(2000);
    expect(loaders()).toBe(0);
    expect(bar().hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('[data-ga-footer]')!.hidden).toBe(true);
  });

  it('still works when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    initAnalytics({ doc: document, win: window, enabled: true });
    vi.advanceTimersByTime(600);
    expect(bar().hidden).toBe(false);
    expect(() => document.querySelector<HTMLElement>('[data-ga-deny]')!.click()).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
  });
});
