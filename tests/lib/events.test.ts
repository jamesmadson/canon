// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CHOICE_KEY, initAnalytics } from '../../src/lib/analytics';
import { listenForEvents, track } from '../../src/lib/events';

let gtag: ReturnType<typeof vi.fn>;
let stop: () => void;

function page() {
  document.body.innerHTML = `
    <a id="app" href="#" data-ga="open_app" data-ga-location="hero"><span id="inner">Open the app</span></a>
    <a id="nav" href="#" data-ga="nav_section" data-ga-section="agents">Agents</a>
    <a id="readme" href="#" data-ga="readme_click">README</a>
    <a id="odd" href="#" data-ga="open_app" data-ga-location="Hello World, ada@example.com">Odd</a>
    <a id="unknown" href="#" data-ga="steal_everything">Nope</a>
    <a id="plain" href="#">Plain</a>`;
}
const click = (id: string) => document.getElementById(id)!.click();

beforeEach(() => {
  stop?.();
  page();
  localStorage.clear();
  gtag = vi.fn();
  (window as any).gtag = gtag;
  stop = listenForEvents(document, window);
});

describe('funnel events', () => {
  it('sends an event with its location when the visitor has allowed analytics', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    click('app');
    expect(gtag).toHaveBeenCalledWith('event', 'open_app', { location: 'hero' });
  });

  it('finds the marked element from a click on something inside it', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    click('inner');
    expect(gtag).toHaveBeenCalledTimes(1);
  });

  it('sends the section for the floating menu and nothing extra for a plain event', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    click('nav');
    click('readme');
    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'nav_section', { section: 'agents' });
    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'readme_click', {});
  });

  it('drops a parameter that is not a short lowercase word, and ignores unknown or unmarked elements', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    click('odd');
    click('unknown');
    click('plain');
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'open_app', {});
  });

  it.each([['deny'], [null]])('does nothing when the saved choice is %s', (choice) => {
    if (choice) localStorage.setItem(CHOICE_KEY, choice);
    click('app');
    track(window, 'copy_setup', { location: 'hero' });
    expect(gtag).not.toHaveBeenCalled();
  });

  it('does nothing when gtag is not loaded', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    delete (window as any).gtag;
    expect(() => click('app')).not.toThrow();
    expect(() => track(window, 'waitlist_done')).not.toThrow();
  });

  it('sends explicit events with their parameters', () => {
    localStorage.setItem(CHOICE_KEY, 'allow');
    track(window, 'copy_setup', { location: 'agents' });
    track(window, 'waitlist_submit');
    expect(gtag).toHaveBeenNthCalledWith(1, 'event', 'copy_setup', { location: 'agents' });
    expect(gtag).toHaveBeenNthCalledWith(2, 'event', 'waitlist_submit', {});
  });
});

describe('consent_choice', () => {
  function bar() {
    document.body.innerHTML = `<div data-ga-bar data-ga-id="G-TEST1234" data-ga-src="https://www.googletagmanager.com/gtag/js?id=G-TEST1234" hidden>
      <button data-ga-allow>Allow</button><button data-ga-deny>No thanks</button></div>`;
    delete (window as any).dataLayer;
    delete (window as any).gtag;
  }
  const events = () => ((window as any).dataLayer ?? []).map((a: ArrayLike<unknown>) => Array.from(a)).filter((a: unknown[]) => a[0] === 'event');

  it('sends allow after consent is updated, and nothing on decline', () => {
    bar();
    initAnalytics({ doc: document, win: window, enabled: true, onChoice: (c) => c === 'allow' && track(window, 'consent_choice', { choice: c }) });
    document.querySelector<HTMLElement>('[data-ga-deny]')!.click();
    expect(events()).toEqual([]);
    document.querySelector<HTMLElement>('[data-ga-allow]')!.click();
    const layer = ((window as any).dataLayer as ArrayLike<unknown>[]).map((a) => Array.from(a));
    const update = layer.findIndex((a) => a[0] === 'consent' && a[1] === 'update' && (a[2] as any).analytics_storage === 'granted');
    const sent = layer.findIndex((a) => a[0] === 'event' && a[1] === 'consent_choice');
    expect(update).toBeGreaterThan(-1);
    expect(sent).toBeGreaterThan(update);
    expect(layer[sent][2]).toEqual({ choice: 'allow' });
  });
});
