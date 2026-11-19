/**
 * The palette of prototype tints. The colours live in src/styles/tints.css as
 * --tint-<name>; this list is the names, in the order a prototype's id picks
 * from. A test keeps the two in step.
 */
export const TINTS = ['sand', 'sage', 'clay', 'slate', 'lilac', 'warm'] as const;
export type Tint = (typeof TINTS)[number];

/** A stable tint for an id, so a list of placeholders is not one grey. */
export function tintOf(id: string): Tint {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}
