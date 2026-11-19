/** The decisions behind Home's row of tag chips, kept pure so tests can check them without a browser. */
import { normalizeTag } from './tags';

export interface Chip { tag: string; width: number; chosen: boolean }

/** How many of the most used tags are measured for the row. The More menu holds all of them. */
export const CANDIDATES = 30;
/** More than this many tags and the More menu gets a search field. */
export const SEARCH_AFTER = 20;

export const sameTag = (a: string, b: string) => normalizeTag(a) === normalizeTag(b);
export const isChosen = (chosen: string[], tag: string) => chosen.some((c) => sameTag(c, tag));

/** Choosing a tag adds it. Choosing one that is on takes it off. Order is the order they were chosen in. */
export const toggleTag = (chosen: string[], tag: string): string[] =>
  isChosen(chosen, tag) ? chosen.filter((c) => !sameTag(c, tag)) : [...chosen, tag];

/**
 * The tags to put in the row, in the order given: the chosen ones always, then the most used that still
 * fit in the room left after "All" and, when something is left out, "More". Rank is kept, so the first one
 * that does not fit ends the row.
 */
export function layoutChips(chips: Chip[], room: number, allWidth: number, moreWidth: number, gap: number): { visible: string[]; overflow: boolean } {
  const total = chips.reduce((n, c) => n + c.width + gap, allWidth + gap);
  if (room <= 0 || total <= room) return { visible: chips.map((c) => c.tag), overflow: false };
  let left = room - allWidth - gap - moreWidth - gap;
  const keep = new Set<string>();
  for (const c of chips) if (c.chosen) { keep.add(c.tag); left -= c.width + gap; }
  for (const c of chips) {
    if (c.chosen) continue;
    if (c.width + gap > left) break;
    keep.add(c.tag);
    left -= c.width + gap;
  }
  const visible = chips.filter((c) => keep.has(c.tag)).map((c) => c.tag);
  return { visible, overflow: true };
}

/** The tags the menu lists for a search: every tag whose words start with, or contain, what was typed. */
export function matchTags<T extends { tag: string }>(tags: T[], query: string): T[] {
  const q = normalizeTag(query);
  return q ? tags.filter((t) => normalizeTag(t.tag).includes(q)) : tags;
}

/** The sidebar's "See all" asks Home for the full tag list. It may be asked before Home is on screen, so the ask waits to be taken. */
let wanted = false;
export function askTagMenu() {
  wanted = true;
  dispatchEvent(new Event('canon-tag-menu'));
}
export function takeTagMenu(): boolean {
  const was = wanted;
  wanted = false;
  return was;
}
