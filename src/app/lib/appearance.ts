/**
 * The app's theme: Match system (the default), Light or Dark. The choice is
 * kept in this browser's localStorage and shows as data-theme on the root
 * element; Match system leaves the attribute off, so the stylesheet follows
 * the system. The page's own inline script applies it before first paint.
 */
export type Appearance = 'system' | 'light' | 'dark';

export const APPEARANCE_KEY = 'canon-appearance';
export const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'Match system' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
/** The ground colour of each theme, for the installed app's title bar. */
export const THEME_COLOR = { light: '#F7F5F2', dark: '#151413' } as const;

const valid = (v: unknown): v is Appearance => v === 'system' || v === 'light' || v === 'dark';

export function readAppearance(storage?: Pick<Storage, 'getItem'>): Appearance {
  try {
    const v = (storage ?? localStorage).getItem(APPEARANCE_KEY);
    return valid(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Where the choice is kept. A failure (private window, blocked storage) means it lasts this visit only. */
export function saveAppearance(choice: Appearance, storage?: Pick<Storage, 'setItem'>) {
  try {
    (storage ?? localStorage).setItem(APPEARANCE_KEY, choice);
  } catch {
    /* kept for this visit only */
  }
}

const systemDark = (win: Window) => !!win.matchMedia?.('(prefers-color-scheme: dark)').matches;

/** Set the theme on the page and keep the theme-color meta in step. */
export function applyAppearance(choice: Appearance, doc: Document = document, win: Window = window) {
  const root = doc.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  const dark = choice === 'system' ? systemDark(win) : choice === 'dark';
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
}

/** Apply the saved choice and, while it is Match system, follow the system as it changes. */
export function startAppearance(doc: Document = document, win: Window = window): () => void {
  applyAppearance(readAppearance(), doc, win);
  const mq = win.matchMedia?.('(prefers-color-scheme: dark)');
  const on = () => { if (readAppearance() === 'system') applyAppearance('system', doc, win); };
  mq?.addEventListener?.('change', on);
  return () => mq?.removeEventListener?.('change', on);
}

export function chooseAppearance(choice: Appearance, doc: Document = document, win: Window = window) {
  saveAppearance(choice);
  applyAppearance(choice, doc, win);
}
