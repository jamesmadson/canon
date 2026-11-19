/**
 * Page or Map: which view of a multi-page prototype the person last chose.
 * Kept for the session only, in memory and in sessionStorage, never in the library.
 */
import type { Frame } from '../db';
import { stackKey } from './versions';

export type PageView = 'page' | 'map';

/** The number of pages a stored prototype has. A link has none to count. */
export const pagesOf = (f: Pick<Frame, 'pages' | 'kind'>): number => (f.kind === 'url' ? 1 : f.pages?.length ?? 1);
export const isMulti = (f: Pick<Frame, 'pages' | 'kind'>): boolean => pagesOf(f) > 1;

/** "5 pages" for a prototype that has a map, otherwise nothing. */
export const pagesLabel = (f: Pick<Frame, 'pages' | 'kind'>): string => (isMulti(f) ? `${pagesOf(f)} pages` : '');

/** A first open lands on the map once there are three pages or more, since two pages need no map. */
export const defaultView = (pages: number): PageView => (pages >= 3 ? 'map' : 'page');

const KEY = 'canon.pageview';
const memory = new Map<string, PageView>();

const read = (): Record<string, PageView> => {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
};

/** One choice for all versions of a prototype. */
const keyOf = (f: Pick<Frame, 'id' | 'stackId'>) => stackKey(f as Frame);

export function viewOf(f: Pick<Frame, 'id' | 'stackId' | 'pages' | 'kind'>): PageView {
  if (!isMulti(f)) return 'page';
  const k = keyOf(f);
  return memory.get(k) ?? read()[k] ?? defaultView(pagesOf(f));
}

export function chooseView(f: Pick<Frame, 'id' | 'stackId'>, v: PageView): void {
  const k = keyOf(f);
  memory.set(k, v);
  try { sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [k]: v })); } catch { /* the choice still holds in memory */ }
}

export function resetViews(): void {
  memory.clear();
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/** The page a map opens with selected, set by a link that names one. Taken once. */
const startPages = new Map<string, string>();
export const setStartPage = (id: string, page: string) => { startPages.set(id, page); };
export const takeStartPage = (id: string): string | undefined => { const p = startPages.get(id); startPages.delete(id); return p; };
