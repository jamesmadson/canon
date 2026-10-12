/** The prototype library: search, filter and sort, kept pure for tests. */

export interface LibraryItem {
  id: string; name: string; kind: 'files' | 'linked' | 'url';
  pages: number; boards: number; comments: number; createdAt: number; updatedAt: number;
}

export interface LibraryFilter {
  query?: string; source?: LibraryItem['kind'] | 'all'; multiPage?: boolean; hasComments?: boolean; unplaced?: boolean;
}

export function filterPrototypes<T extends LibraryItem>(items: T[], f: LibraryFilter): T[] {
  const q = f.query?.trim().toLowerCase();
  return items.filter(
    (i) =>
      (!q || i.name.toLowerCase().includes(q)) &&
      (!f.source || f.source === 'all' || i.kind === f.source) &&
      (!f.multiPage || i.pages > 1) &&
      (!f.hasComments || i.comments > 0) &&
      (!f.unplaced || i.boards === 0)
  );
}

export type LibrarySort = 'added' | 'name' | 'comments' | 'updated';

export function sortPrototypes<T extends LibraryItem>(items: T[], by: LibrarySort): T[] {
  const list = [...items];
  if (by === 'name') return list.sort((a, b) => a.name.localeCompare(b.name));
  if (by === 'comments') return list.sort((a, b) => b.comments - a.comments || b.createdAt - a.createdAt);
  if (by === 'updated') return list.sort((a, b) => b.updatedAt - a.updatedAt);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

/** A stable colour per person, from a short palette that reads on dark. */
export function personColor(name: string): string {
  const palette = ['#4d8dff', '#f26d5b', '#3ccf7f', '#c084fc', '#f5b041', '#22c3d6'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}
