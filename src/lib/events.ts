/**
 * Funnel events for Google Analytics, on the marketing pages only. Nothing in
 * src/app imports this, and a test checks the built app for the event names.
 *
 * An event is sent only when gtag exists and the visitor has chosen Allow.
 * Otherwise every call here does nothing: in the dev server, under "No
 * thanks", and under Global Privacy Control. Events carry a name and at most
 * a location, a section or a choice, each a short lowercase word. Never an
 * address or free text.
 */
import { readChoice } from './analytics';

export const EVENTS = [
  'open_app',
  'try_mcp_open',
  'copy_setup',
  'waitlist_submit',
  'waitlist_done',
  'nav_section',
  'readme_click',
  'github_click',
  'consent_choice',
] as const;
export type EventName = (typeof EVENTS)[number];
export type EventParams = Partial<Record<'location' | 'section' | 'choice', string>>;

type Gtag = (...args: unknown[]) => void;

/** A parameter value is a short lowercase word, so free text cannot get through. */
const SAFE = /^[a-z][a-z_-]{0,23}$/;

export function track(win: Window, name: EventName, params: EventParams = {}): void {
  const gtag = (win as Window & { gtag?: Gtag }).gtag;
  if (typeof gtag !== 'function' || readChoice(win) !== 'allow') return;
  if (!EVENTS.includes(name)) return;
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (typeof v === 'string' && SAFE.test(v)) clean[k] = v;
  gtag('event', name, clean);
}

/**
 * One delegated click listener. An element marked data-ga="open_app" sends
 * that event, with data-ga-location or data-ga-section as its parameter.
 */
export function listenForEvents(doc: Document, win: Window): () => void {
  const onClick = (e: Event) => {
    const el = (e.target as Element | null)?.closest?.<HTMLElement>('[data-ga]');
    const name = el?.dataset.ga as EventName | undefined;
    if (!el || !name || !EVENTS.includes(name)) return;
    track(win, name, { location: el.dataset.gaLocation, section: el.dataset.gaSection });
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}
