/** Small decisions the prototype view makes, kept pure so tests can check them without a browser. */
import type { Frame } from '../db';
import { whenLabel } from './home';

/** "Version 3 of 5", only when there is more than one. */
export const versionTitle = (n: number, total: number) => (total > 1 ? `Version ${n} of ${total}` : '');

/** The version before or after this one in a stack held oldest first. Does not wrap. */
export function neighbour<T extends { id: string }>(stack: T[], id: string, dir: -1 | 1): T | undefined {
  const at = stack.findIndex((v) => v.id === id);
  return at < 0 ? undefined : stack[at + dir];
}

export const kindWord = (f: Pick<Frame, 'kind'>) => (f.kind === 'url' ? 'Link' : 'Stored copy');

/** One line of the versions menu: "Version 2 · Yesterday · Link · Current". */
export function versionLine(n: number, f: Pick<Frame, 'kind' | 'createdAt'>, current: boolean, now = Date.now()) {
  return `Version ${n} · ${whenLabel(f.createdAt, now)} · ${kindWord(f)}${current ? ' · Current' : ''}`;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** The scale that shows a page of this width in the room there is, never larger than life. Fill (null) is life size. */
export function fitZoom(width: number | null, room: number): number {
  if (width === null || !room || room >= width) return 1;
  return clampZoom(room / width);
}

/** Whether the key press happened somewhere the person is typing or choosing, so arrow keys belong to that. */
export function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return true;
  return !!el.closest?.('[role="dialog"], [role="menu"], [role="listbox"]');
}

export const FRAME_BLOCKED = 'This site can’t be shown inside\u00a0Canon';
export const LIVE_HINT = 'Live shows the running version at its localhost address. Off shows the stored copy.';

/** The first few tags the prototype bar shows, and how many more there are. */
export const tagsForBar = (tags: string[], max = 3) => ({ shown: tags.slice(0, max), more: Math.max(0, tags.length - max) });
