/** Which row a key moves to in a list. Stops at the ends and never wraps. */
export function moveSelection(index: number, count: number, key: string): number {
  if (count <= 0) return 0;
  const last = count - 1;
  const here = Math.min(Math.max(index, 0), last);
  if (key === 'ArrowDown') return Math.min(here + 1, last);
  if (key === 'ArrowUp') return Math.max(here - 1, 0);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  return here;
}

type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean };

/** Command or Control with K opens the search. */
export const isSearchHotkey = (e: KeyLike) => (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k';
