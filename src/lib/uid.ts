/**
 * A monotonic id source for SVG defs.
 *
 * clipPath, mask and filter ids are document-global, so two copies of the same
 * drawing on one page collide and the second one renders unclipped. Astro
 * frontmatter runs once per instance, so a counter has to live in a module
 * rather than in the component that needs it.
 */
let seq = 0;

export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}
