/** The metadata a prototype carries across its versions, read off one stored frame. */
import type { Frame, FrameMeta } from '../db';

export const META_KEYS = ['summary', 'repo', 'branch', 'tool', 'tags', 'removedTags', 'starred', 'note', 'archived'] as const;

/** Only the keys the frame has. A frame saved before these fields reads as empty and gains nothing. */
export function metaOf(f: Partial<Frame>): FrameMeta {
  const out: Record<string, unknown> = {};
  for (const k of META_KEYS) if (f[k] !== undefined) out[k] = f[k];
  return out as FrameMeta;
}

/**
 * What a new version takes from the version it replaces: the prototype's
 * star, note, tags and the rest, so adding a version never loses them. The
 * lists are copied, so the two versions never share one array.
 */
export function inheritedMeta(previous: Partial<Frame>): FrameMeta {
  const meta = metaOf(previous);
  if (meta.tags) meta.tags = [...meta.tags];
  if (meta.removedTags) meta.removedTags = [...meta.removedTags];
  return meta;
}
