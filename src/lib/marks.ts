/**
 * The names of the eight marks in RamsMark.
 *
 * Kept out of the component so anything that chooses a mark — the onboarding
 * shell picking one per step, for instance — can name the type without
 * importing the SVG alongside it.
 */
export type MarkName =
  | 'dot-grid'
  | 'line-stack'
  | 'dial'
  | 'split-stripe'
  | 'rings'
  | 'disc'
  | 'arc'
  | 'fader';
