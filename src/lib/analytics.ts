/**
 * Google Analytics for the marketing pages, behind a consent choice. Nothing
 * here runs in the app: only the marketing layout includes the component that
 * loads this (see Analytics.astro and the test that checks the built app).
 *
 * Consent mode starts with everything denied. The one thing a visitor can
 * allow is analytics storage. The ad settings are never granted.
 */

export const CHOICE_KEY = 'canon-analytics';
export type Choice = 'allow' | 'deny';

export const DENIED = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
} as const;

type Gtag = (...args: unknown[]) => void;
type Win = Window & typeof globalThis & { dataLayer?: unknown[]; gtag?: Gtag };

export function readChoice(win: Window): Choice | null {
  try {
    const v = win.localStorage.getItem(CHOICE_KEY);
    return v === 'allow' || v === 'deny' ? v : null;
  } catch {
    return null;
  }
}

export function saveChoice(win: Window, choice: Choice): void {
  try {
    win.localStorage.setItem(CHOICE_KEY, choice);
  } catch {
    // The choice then lasts only for this visit.
  }
}

/** True when the browser sends the Global Privacy Control signal. */
export function privacySignal(nav: Navigator): boolean {
  return (nav as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
}

export type AnalyticsOptions = {
  doc: Document;
  win: Window;
  /** False in the dev server, so local work does not count as visits. */
  enabled: boolean;
  /** How long the bar waits before it fades in, in milliseconds. */
  delay?: number;
};

export function initAnalytics({ doc, win: plainWin, enabled, delay = 600 }: AnalyticsOptions) {
  const win = plainWin as Win;
  const bar = doc.querySelector<HTMLElement>('[data-ga-bar]');
  if (!bar || !enabled) return null;
  const id = bar.dataset.gaId ?? '';
  const src = bar.dataset.gaSrc ?? '';
  if (!/^G-[A-Z0-9]+$/.test(id) || !src.includes(id)) return null;

  const openers = [...doc.querySelectorAll<HTMLElement>('[data-ga-open]')];
  for (const el of doc.querySelectorAll<HTMLElement>('[data-ga-footer]')) el.hidden = false;

  let loaded = false;
  function load(granted: boolean) {
    if (loaded) return;
    loaded = true;
    win.dataLayer = win.dataLayer || [];
    // gtag reads the arguments object, so this cannot be an arrow function.
    win.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      win.dataLayer!.push(arguments);
    };
    const gtag = win.gtag;
    gtag('consent', 'default', { ...DENIED });
    if (granted) gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', id, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = doc.createElement('script');
    s.async = true;
    s.src = src;
    doc.head.appendChild(s);
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  function show() {
    clearTimeout(timer);
    bar!.hidden = false;
    void bar!.offsetWidth; // Lets the fade start from the hidden state.
    bar!.classList.add('is-on');
  }
  function hide() {
    clearTimeout(timer);
    bar!.classList.remove('is-on');
    timer = setTimeout(() => {
      bar!.hidden = true;
    }, 320);
  }

  function choose(choice: Choice) {
    saveChoice(win, choice);
    if (choice === 'allow') {
      if (loaded) win.gtag!('consent', 'update', { analytics_storage: 'granted' });
      else load(true);
    } else if (loaded) {
      win.gtag!('consent', 'update', { analytics_storage: 'denied' });
    }
    hide();
    openers[0]?.focus();
  }

  bar.querySelector('[data-ga-allow]')?.addEventListener('click', () => choose('allow'));
  bar.querySelector('[data-ga-deny]')?.addEventListener('click', () => choose('deny'));
  for (const o of openers) o.addEventListener('click', show);

  // A choice made earlier wins. With none, a privacy signal counts as no.
  const stored = readChoice(win);
  const gpc = privacySignal(win.navigator);
  const effective: Choice | null = stored ?? (gpc ? 'deny' : null);
  if (effective !== 'deny') load(effective === 'allow');
  if (stored === null && !gpc) timer = setTimeout(show, delay);

  return { show, hide, choose };
}
