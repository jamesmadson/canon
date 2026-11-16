/** The prototype library: search, filter and sort, kept pure for tests. */
import { normalizeTag } from './tags';

export interface LibraryItem {
  id: string; name: string; kind: 'files' | 'linked' | 'url';
  pages: number; boards: number; comments: number; createdAt: number; updatedAt: number;
  summary?: string; tags?: string[]; starred?: boolean; archived?: boolean;
}

export interface LibraryFilter {
  query?: string; source?: LibraryItem['kind'] | 'all'; multiPage?: boolean; hasComments?: boolean; unplaced?: boolean;
  /** Prototypes carrying every one of these tags. */
  tags?: string[];
  /** True shows only archived prototypes. Otherwise they stay out of the list. */
  archived?: boolean;
}

export function filterPrototypes<T extends LibraryItem>(items: T[], f: LibraryFilter): T[] {
  const q = f.query?.trim().toLowerCase();
  const want = (f.tags ?? []).map(normalizeTag).filter(Boolean);
  const says = (s: string | undefined) => (s ?? '').toLowerCase().includes(q ?? '');
  return items.filter(
    (i) =>
      !!i.archived === !!f.archived &&
      (!q || says(i.name) || says(i.summary) || (i.tags ?? []).some(says)) &&
      (!want.length || want.every((t) => (i.tags ?? []).map(normalizeTag).includes(t))) &&
      (!f.source || f.source === 'all' || i.kind === f.source) &&
      (!f.multiPage || i.pages > 1) &&
      (!f.hasComments || i.comments > 0) &&
      (!f.unplaced || i.boards === 0)
  );
}

export type LibrarySort = 'added' | 'name' | 'comments' | 'updated' | 'starred';

export function sortPrototypes<T extends LibraryItem>(items: T[], by: LibrarySort): T[] {
  const list = [...items];
  if (by === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
  if (by === 'comments') return list.sort((a, b) => b.comments - a.comments || b.createdAt - a.createdAt);
  if (by === 'updated') return list.sort((a, b) => b.updatedAt - a.updatedAt);
  if (by === 'starred') return list.sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || b.updatedAt - a.updatedAt);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

/**
 * A stable look per person, in Canon's colours only: orange with ink initials,
 * or the pin colour with white ones. The disc carries the initials, so two
 * people are never told apart by colour alone.
 */
export function personTone(name: string): 'orange' | 'pin' {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 2 === 0 ? 'orange' : 'pin';
}
